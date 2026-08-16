import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/data/calendar_repository.dart';

/// What happened when the rep pushed the rest of the day.
class PushedDay {
  const PushedDay({required this.moved, required this.blocked});

  final int moved;

  /// Stops the server would not move, named — usually because something else
  /// already sits where they would land.
  final List<String> blocked;
}

String _mintKey() =>
    'push-${DateTime.now().microsecondsSinceEpoch}-${identityHashCode(Object())}';

/// Moves every remaining planned stop later by [by] — §15.7.7.
///
/// **Latest first, deliberately.** Shifting the 14:00 onto the 15:00's slot
/// before the 15:00 has moved is a conflict the server is right to refuse, so
/// walking backwards keeps each landing spot empty as it goes.
///
/// A stop that cannot move does not stop the ones behind it: the rep asked for
/// the day to be pushed, and getting three of four moved with the fourth named
/// is more useful than an all-or-nothing failure at the moment they are already
/// late.
Future<PushedDay> pushTheDay({
  required CalendarMutationRepositoryContract repository,
  required List<CalendarOccurrence> stops,
  required Duration by,
}) async {
  var moved = 0;
  final blocked = <String>[];

  final ordered = stops.toList(growable: false)
    ..sort((a, b) => b.startsAt.compareTo(a.startsAt));

  for (final stop in ordered) {
    try {
      await repository.updateCalendarOccurrence(
        calendarId: stop.calendarId,
        recurrenceKey: stop.recurrenceKey,
        command: CalendarOccurrenceUpdateCommand(
          // The override's version, or zero when this occurrence has never been
          // moved before — the same convention the editor uses.
          expectedVersion: stop.overrideVersion ?? 0,
          // UTC in, UTC out: the occurrence's instants already carry the zone,
          // and re-deriving a local offset here would move a visit by it.
          startsAt: stop.startsAt.toUtc().add(by).toIso8601String(),
          durationMinutes: stop.durationMinutes,
        ),
        idempotencyKey: _mintKey(),
      );
      moved += 1;
    } on CalendarApiException {
      blocked.add(stop.facility?.name ?? stop.title);
    }
  }

  return PushedDay(moved: moved, blocked: blocked);
}
