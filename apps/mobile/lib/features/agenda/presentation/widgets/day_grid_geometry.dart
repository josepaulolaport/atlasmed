import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';

/// Height of one hour in the day grid. Shared so the gesture maths and the
/// painting agree — they are the same coordinate space, and two constants that
/// drift make a block land where it was not dropped.
const kHourHeight = 64.0;
const kGutterWidth = 56.0;

/// The granularity the calendar stores. Everything the rep drags snaps to it,
/// because a 12-minute appointment is not something the API will keep and
/// rounding it after the fact is the silent shift spec 0016 §7.3 forbids.
const kSlotMinutes = 30;

/// Shortest appointment the grid will let a drag produce.
const kMinDurationMinutes = 30;

/// A block the rep is drawing on the grid, before it is anything real.
///
/// Held as minutes from midnight rather than as `DateTime`s: every gesture is
/// arithmetic on the grid's own axis, and converting on each frame invites the
/// DST bugs that come from doing clock maths in local time.
class DayGridDraft {
  const DayGridDraft({required this.startMinutes, required this.endMinutes});

  final int startMinutes;
  final int endMinutes;

  int get durationMinutes => endMinutes - startMinutes;

  DateTime startsAt(DateTime day) => DateTime(
    day.year,
    day.month,
    day.day,
  ).add(Duration(minutes: startMinutes));

  DateTime endsAt(DateTime day) =>
      DateTime(day.year, day.month, day.day).add(Duration(minutes: endMinutes));

  DayGridDraft copyWith({int? startMinutes, int? endMinutes}) => DayGridDraft(
    startMinutes: startMinutes ?? this.startMinutes,
    endMinutes: endMinutes ?? this.endMinutes,
  );
}

/// Rounds to the nearest slot. Nearest rather than down: dragging a handle
/// upward should be able to reach the slot above it, and flooring means the
/// last few pixels of every drag do nothing.
int snapToSlot(double minutes) =>
    (minutes / kSlotMinutes).round() * kSlotMinutes;

int minutesFromOffset(double dy) => snapToSlot(dy / kHourHeight * 60);

double offsetFromMinutes(int minutes) => minutes / 60 * kHourHeight;

/// Where a press lands, as a draft of the default length.
///
/// Clamped so a press near midnight still produces a whole appointment rather
/// than one that runs off the end of the day.
DayGridDraft draftAt(double dy, {int durationMinutes = 60}) {
  final start = minutesFromOffset(dy).clamp(0, 24 * 60 - durationMinutes);
  return DayGridDraft(startMinutes: start, endMinutes: start + durationMinutes);
}

/// Moves the whole block, keeping its length.
///
/// The length is preserved rather than recomputed from both edges: a rep
/// dragging a block to a different hour has said nothing about how long it is,
/// and quietly resizing it would answer a question they did not ask.
DayGridDraft moveDraft(DayGridDraft draft, double deltaY) {
  final shift = snapToSlot(deltaY / kHourHeight * 60);
  final duration = draft.durationMinutes;
  final start = (draft.startMinutes + shift).clamp(0, 24 * 60 - duration);
  return DayGridDraft(startMinutes: start, endMinutes: start + duration);
}

/// Drags the top edge. The end stays put, so the block grows upward.
DayGridDraft resizeStart(DayGridDraft draft, double dy) {
  final start = minutesFromOffset(
    dy,
  ).clamp(0, draft.endMinutes - kMinDurationMinutes);
  return draft.copyWith(startMinutes: start);
}

/// Drags the bottom edge.
DayGridDraft resizeEnd(DayGridDraft draft, double dy) {
  final end = minutesFromOffset(
    dy,
  ).clamp(draft.startMinutes + kMinDurationMinutes, 24 * 60);
  return draft.copyWith(endMinutes: end);
}

/// Everything already on the day that this draft would run into.
///
/// Surfaced rather than prevented: the rep may be double-booking on purpose and
/// only they can decide, but the API refuses a clash on save (which is why
/// `DaySchedulePicker` marks busy slots at all), so finding out at the moment
/// of the drag is the difference between a choice and a rejection.
List<CalendarOccurrence> draftClashes(
  DayGridDraft draft,
  DateTime day,
  List<CalendarOccurrence> occurrences,
) {
  final start = draft.startsAt(day);
  final end = draft.endsAt(day);
  return occurrences.where((occurrence) {
    final occurrenceStart = occurrence.startsAt.toLocal();
    final occurrenceEnd = occurrence.endsAt.toLocal();
    return start.isBefore(occurrenceEnd) && occurrenceStart.isBefore(end);
  }).toList();
}

/// Where one event sits when the day double-books.
class DayGridLane {
  const DayGridLane({
    required this.occurrence,
    required this.column,
    required this.columns,
  });

  final CalendarOccurrence occurrence;
  final int column;
  final int columns;
}

/// Lays overlapping events side by side instead of on top of each other.
///
/// Every block used to span the full width, so a double-booking rendered one
/// appointment over another and the rep could see and tap only whichever was
/// painted last — in a grid whose entire job is showing what the day already
/// holds and what still fits.
///
/// Events are grouped into clusters of mutual overlap, and the cluster's width
/// is shared. A cluster rather than a pairwise check because three appointments
/// can chain — A overlaps B, B overlaps C, A and C do not — and splitting the
/// width only between the pair that touches would still stack A and C.
List<DayGridLane> layOutOverlaps(List<CalendarOccurrence> occurrences) {
  final ordered = [...occurrences]
    ..sort((a, b) => a.startsAt.compareTo(b.startsAt));

  final lanes = <DayGridLane>[];
  var index = 0;
  while (index < ordered.length) {
    // Extend the cluster while anything in it still runs past the next start.
    var clusterEnd = ordered[index].endsAt;
    var last = index + 1;
    while (last < ordered.length &&
        ordered[last].startsAt.isBefore(clusterEnd)) {
      if (ordered[last].endsAt.isAfter(clusterEnd)) {
        clusterEnd = ordered[last].endsAt;
      }
      last += 1;
    }

    final cluster = ordered.sublist(index, last);
    // Within a cluster, reuse a column as soon as its last event has finished:
    // three appointments where only two ever overlap should use two columns,
    // not three, or a busy morning shrinks to unreadable slivers.
    final columnEnds = <DateTime>[];
    final assigned = <int>[];
    for (final occurrence in cluster) {
      var column = columnEnds.indexWhere(
        (end) => !end.isAfter(occurrence.startsAt),
      );
      if (column == -1) {
        columnEnds.add(occurrence.endsAt);
        column = columnEnds.length - 1;
      } else {
        columnEnds[column] = occurrence.endsAt;
      }
      assigned.add(column);
    }

    for (var i = 0; i < cluster.length; i += 1) {
      lanes.add(
        DayGridLane(
          occurrence: cluster[i],
          column: assigned[i],
          columns: columnEnds.length,
        ),
      );
    }
    index = last;
  }
  return lanes;
}

/// `HH:MM` for a minutes-from-midnight value.
String formatSlot(int minutes) {
  final hour = (minutes ~/ 60) % 24;
  final minute = minutes % 60;
  return '${hour.toString().padLeft(2, '0')}:${minute.toString().padLeft(2, '0')}';
}
