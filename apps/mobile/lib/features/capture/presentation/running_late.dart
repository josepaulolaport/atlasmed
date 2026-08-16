import 'dart:math' as math;

import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';

/// How far behind the day has fallen, and what is still waiting on it.
///
/// §15.7.7 — an overrun used to be invisible until each later stop quietly
/// became a miss at its own window's end. One visit running long is the most
/// common way a planned day comes apart, and the rep is the only one who can
/// decide what gives.
class RunningLate {
  const RunningLate({
    required this.by,
    required this.running,
    required this.waiting,
  });

  /// How far past its planned end the current stop already is.
  final Duration by;

  /// The stop the rep is in.
  final CalendarOccurrence running;

  /// The stops still to come today, in order — what the overrun eats into.
  final List<CalendarOccurrence> waiting;
}

/// Whether the day is behind, given what is on it and the time now.
///
/// Deliberately measured from the **running** stop rather than from any stop
/// whose start has passed: a rep who has not pressed Cheguei yet may simply be
/// driving, and telling them they are late for something they are on their way
/// to is noise. An overrun, by contrast, is a fact the rep is living.
///
/// [threshold] keeps the banner off the screen for the ordinary five minutes
/// that every visit runs over.
RunningLate? runningLate(
  List<CalendarOccurrence> day,
  DateTime now, {
  Duration threshold = const Duration(minutes: 10),
}) {
  final running = day
      .where(
        (item) => item.interaction?.status == InteractionStatus.inProgress,
      )
      .firstOrNull;
  if (running == null) return null;

  final over = now.difference(running.endsAt.toLocal());
  if (over < threshold) return null;

  // Only what is still ahead and still a plan. A stop already completed cannot
  // be pushed, and one already missed is not waiting on anything.
  final waiting = day
      .where(
        (item) =>
            item.interaction?.status == InteractionStatus.scheduled &&
            item.startsAt.isAfter(running.startsAt),
      )
      .toList(growable: false);
  if (waiting.isEmpty) return null;

  return RunningLate(by: over, running: running, waiting: waiting);
}

/// "35 min" / "1 h 05" — the overrun, said the way a rep would say it.
String formatOverrun(Duration value) {
  final minutes = math.max(1, value.inMinutes);
  if (minutes < 60) return '$minutes min';
  final hours = minutes ~/ 60;
  final rest = minutes % 60;
  return rest == 0 ? '${hours}h' : '${hours}h${rest.toString().padLeft(2, '0')}';
}
