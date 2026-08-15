import 'package:atlasmed_mobile_app/features/roteiro/data/roteiro.dart';

String _hhmm(DateTime at) =>
    '${at.hour.toString().padLeft(2, '0')}:${at.minute.toString().padLeft(2, '0')}';

/// Durations the calendar can actually hold.
///
/// Multiples of 30 because the calendar rounds up to its slot (spec 0016 §7.3):
/// offering 45 would show the rep a number their own agenda then changes behind
/// them, which is the silent shift the spec forbids.
const kRoteiroDurationChoices = <int>[30, 60, 90, 120, 180];

/// A stop whose time the rep moved, or whose neighbours moved under it.
class ScheduledStop {
  const ScheduledStop({
    required this.stop,
    required this.startsAt,
    required this.endsAt,
    required this.edited,
    required this.shifted,
  });

  final RoteiroStop stop;
  final DateTime startsAt;
  final DateTime endsAt;

  /// The rep changed this one themselves.
  final bool edited;

  /// This one moved because something else did. Marked so the rep can see the
  /// consequence of their edit rather than discovering it on the road.
  final bool shifted;

  int get durationMinutes => endsAt.difference(startsAt).inMinutes;
}

/// Something the rep's edit broke. Surfaced, never silently corrected — the
/// only person who can decide between a clinic and a commitment is the rep.
class RoteiroScheduleWarning {
  const RoteiroScheduleWarning(this.message);
  final String message;
}

class RoteiroSchedule {
  const RoteiroSchedule({required this.stops, required this.warnings});

  final List<ScheduledStop> stops;
  final List<RoteiroScheduleWarning> warnings;

  bool get hasWarnings => warnings.isNotEmpty;
}

/// Recomputes the day after the rep changed a duration or a start time.
///
/// **The delta travels in the direction of the change.** Push a stop later and
/// everything after it moves later by the same amount; pull one earlier and
/// everything before it moves earlier. A visit that grows pushes the rest of the
/// day back; one that shrinks pulls it forward and closes the hole.
///
/// Travel legs are carried, not recomputed: the rep changed *when*, not *where*,
/// so the order and therefore the driving between stops is unchanged. Anything
/// that would change the route has to go back to the engine, which is what
/// regenerating is for.
RoteiroSchedule buildSchedule({
  required List<RoteiroStop> stops,
  required List<RoteiroFixedPoint> fixedPoints,
  Map<int, int> durationOverrides = const {},
  Map<int, DateTime> startOverrides = const {},
  DateTime? workdayEndsAt,
}) {
  final ordered = [...stops]
    ..sort((a, b) => a.plannedStartsAt.compareTo(b.plannedStartsAt));

  final starts = <DateTime>[];
  final ends = <DateTime>[];
  final edited = <bool>[];

  for (final stop in ordered) {
    final id = stop.facilityVerticalProfileId;
    final duration = durationOverrides[id] ?? stop.serviceMinutes;
    final start = startOverrides[id] ?? stop.plannedStartsAt;
    starts.add(start);
    ends.add(start.add(Duration(minutes: duration)));
    edited.add(
      durationOverrides.containsKey(id) || startOverrides.containsKey(id),
    );
  }

  final shifted = List<bool>.filled(ordered.length, false);

  // Each edit propagates once, in its own direction, from where it happened.
  for (var i = 0; i < ordered.length; i += 1) {
    if (!edited[i]) continue;
    final stop = ordered[i];
    final id = stop.facilityVerticalProfileId;

    final startDelta = startOverrides.containsKey(id)
        ? startOverrides[id]!.difference(stop.plannedStartsAt)
        : Duration.zero;
    final durationDelta = Duration(
      minutes:
          (durationOverrides[id] ?? stop.serviceMinutes) - stop.serviceMinutes,
    );

    // Moving earlier takes what comes before with it; there is nowhere else for
    // the time to come from.
    if (startDelta.isNegative) {
      for (var j = 0; j < i; j += 1) {
        starts[j] = starts[j].add(startDelta);
        ends[j] = ends[j].add(startDelta);
        shifted[j] = true;
      }
    }

    // Everything after follows the *end* of this stop — which both a later
    // start and a longer visit move.
    final after = startDelta.isNegative
        ? durationDelta
        : startDelta + durationDelta;
    if (after != Duration.zero) {
      for (var j = i + 1; j < ordered.length; j += 1) {
        starts[j] = starts[j].add(after);
        ends[j] = ends[j].add(after);
        shifted[j] = true;
      }
    }
  }

  final result = <ScheduledStop>[
    for (var i = 0; i < ordered.length; i += 1)
      ScheduledStop(
        stop: ordered[i],
        startsAt: starts[i],
        endsAt: ends[i],
        edited: edited[i],
        // An edited stop is not also "shifted" — the rep knows it moved.
        shifted: shifted[i] && !edited[i],
      ),
  ]..sort((a, b) => a.startsAt.compareTo(b.startsAt));

  return RoteiroSchedule(
    stops: result,
    warnings: _warnings(result, fixedPoints, workdayEndsAt),
  );
}

List<RoteiroScheduleWarning> _warnings(
  List<ScheduledStop> result,
  List<RoteiroFixedPoint> fixedPoints,
  DateTime? workdayEndsAt,
) {
  final warnings = <RoteiroScheduleWarning>[];

  // The engine never plans past the end of the workday. The rep can, by
  // lengthening a visit — and a day that quietly runs to 18:28 is not a plan
  // anyone can keep, so it is said rather than absorbed.
  //
  // Deliberately **not** phrased as "your hours". The bound comes from
  // `roteiro_params.workday_end`, which is per *linha* and today has no row at
  // all, so every rep is planned against the same hardcoded 18:00. Calling that
  // the rep's own schedule would invent a preference nobody ever set — and the
  // first rep who works until 20:00 would rightly stop believing the warning.
  // Named for what it is until working hours are actually per rep (§16).
  final last = result.isEmpty ? null : result.last;
  if (workdayEndsAt != null &&
      last != null &&
      last.endsAt.isAfter(workdayEndsAt)) {
    final over = last.endsAt.difference(workdayEndsAt).inMinutes;
    warnings.add(
      RoteiroScheduleWarning(
        'O dia agora termina $over min depois das '
        '${_hhmm(workdayEndsAt)} (${_hhmm(last.endsAt)}), o limite usado '
        'para montar o roteiro.',
      ),
    );
  }

  // A commitment already in the calendar cannot move to make room. If an edit
  // runs into one, the rep has a real conflict to resolve, not a display bug.
  for (final scheduled in result) {
    for (final point in fixedPoints) {
      if (scheduled.startsAt.isBefore(point.endsAt) &&
          point.startsAt.isBefore(scheduled.endsAt)) {
        warnings.add(
          RoteiroScheduleWarning(
            '${scheduled.stop.facilityName} agora conflita com '
            '${point.facilityName}, que já está na sua agenda.',
          ),
        );
      }
    }
  }

  // Two suggestions overlapping means the drive between them no longer fits.
  // Said in terms of the drive, because that is the thing that got squeezed.
  for (var i = 1; i < result.length; i += 1) {
    final previous = result[i - 1];
    final current = result[i];
    final travel = Duration(seconds: current.stop.travelSecondsFromPrev ?? 0);
    if (current.startsAt.isBefore(previous.endsAt.add(travel))) {
      warnings.add(
        RoteiroScheduleWarning(
          'Não sobra tempo de deslocamento entre '
          '${previous.stop.facilityName} e ${current.stop.facilityName}.',
        ),
      );
    }
  }

  return warnings;
}
