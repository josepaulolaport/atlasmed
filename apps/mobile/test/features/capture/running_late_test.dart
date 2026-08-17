import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/data/calendar_repository.dart';
import 'package:atlasmed_mobile_app/features/capture/presentation/push_the_day.dart';
import 'package:atlasmed_mobile_app/features/capture/presentation/running_late.dart';
import 'package:flutter_test/flutter_test.dart';

CalendarOccurrence _stop({
  required int hour,
  required int id,
  String status = 'SCHEDULED',
  int? overrideVersion,
}) => CalendarOccurrence.fromJson({
  'id': '$id:key-$hour',
  'calendarId': id,
  'recurrenceKey': 'key-$hour',
  'ownerUserId': 2,
  'kind': 'INTERACTION',
  'title': 'Visita $hour',
  'startsAt': DateTime.utc(2026, 8, 16, hour).toIso8601String(),
  'endsAt': DateTime.utc(2026, 8, 16, hour + 1).toIso8601String(),
  'timeZone': 'America/Sao_Paulo',
  'durationMinutes': 60,
  'recurrence': 'NONE',
  'version': 1,
  'canMutate': true,
  if (overrideVersion != null) 'overrideVersion': overrideVersion,
  'interaction': {'id': id, 'facilityId': 9, 'status': status, 'version': 3},
});

class _Moves implements CalendarMutationRepositoryContract {
  final List<({int calendarId, String startsAt, int expectedVersion})> moves =
      [];
  final Set<int> refuse = {};

  @override
  Future<void> updateCalendarOccurrence({
    required int calendarId,
    required String recurrenceKey,
    required CalendarOccurrenceUpdateCommand command,
    required String idempotencyKey,
  }) async {
    if (refuse.contains(calendarId)) {
      throw const CalendarConflictException('Conflito', conflicts: []);
    }
    moves.add((
      calendarId: calendarId,
      startsAt: command.startsAt,
      expectedVersion: command.expectedVersion,
    ));
  }

  @override
  Future<void> createCalendar({
    required CalendarCreateCommand command,
    required String idempotencyKey,
  }) async {}
  @override
  Future<void> updateCalendar({
    required int calendarId,
    required CalendarUpdateCommand command,
    required String idempotencyKey,
  }) async {}
  @override
  Future<void> cancelCalendar({
    required int calendarId,
    required CalendarCancellationCommand command,
    required String idempotencyKey,
  }) async {}
  @override
  Future<void> cancelCalendarOccurrence({
    required int calendarId,
    required String recurrenceKey,
    required CalendarCancellationCommand command,
    required String idempotencyKey,
  }) async {}
}

void main() {
  group('runningLate', () {
    final day = [
      _stop(hour: 9, id: 1, status: 'IN_PROGRESS'),
      _stop(hour: 11, id: 2),
      _stop(hour: 13, id: 3),
    ];

    test('measures the overrun from the stop the rep is in', () {
      // 09:00–10:00, still running at 10:35.
      final late = runningLate(
        day,
        DateTime.utc(2026, 8, 16, 10, 35).toLocal(),
      );

      expect(late, isNotNull);
      expect(late!.by.inMinutes, 35);
      expect(late.waiting.map((s) => s.calendarId), [2, 3]);
    });

    test('says nothing about the five minutes every visit runs over', () {
      expect(
        runningLate(day, DateTime.utc(2026, 8, 16, 10, 5).toLocal()),
        isNull,
      );
    });

    test('says nothing when no stop is running', () {
      // A rep who has not pressed Cheguei may simply be driving there, and
      // being told they are late for something they are on the way to is noise.
      final planned = [_stop(hour: 9, id: 1), _stop(hour: 11, id: 2)];
      expect(
        runningLate(planned, DateTime.utc(2026, 8, 16, 12).toLocal()),
        isNull,
      );
    });

    test('says nothing when the overrun eats into nothing', () {
      final last = [_stop(hour: 9, id: 1, status: 'IN_PROGRESS')];
      expect(
        runningLate(last, DateTime.utc(2026, 8, 16, 11).toLocal()),
        isNull,
      );
    });
  });

  group('pushTheDay', () {
    test('moves the latest first so each landing spot is empty', () async {
      // Shifting the 11:00 onto the 13:00's slot before the 13:00 has moved is
      // a conflict the server is right to refuse.
      final repository = _Moves();

      final result = await pushTheDay(
        repository: repository,
        stops: [_stop(hour: 11, id: 2), _stop(hour: 13, id: 3)],
        by: const Duration(minutes: 35),
      );

      expect(repository.moves.map((m) => m.calendarId), [3, 2]);
      expect(repository.moves.first.startsAt, contains('13:35'));
      expect(result.moved, 2);
      expect(result.blocked, isEmpty);
    });

    test('one stop that cannot move does not strand the others', () async {
      // The rep asked for the day to be pushed while already late; three of
      // four moved with the fourth named beats an all-or-nothing failure.
      final repository = _Moves()..refuse.add(2);

      final result = await pushTheDay(
        repository: repository,
        stops: [_stop(hour: 11, id: 2), _stop(hour: 13, id: 3)],
        by: const Duration(minutes: 30),
      );

      expect(result.moved, 1);
      expect(result.blocked, hasLength(1));
    });

    test(
      "sends the override's version, or zero when it has never moved",
      () async {
        final repository = _Moves();

        await pushTheDay(
          repository: repository,
          stops: [
            _stop(hour: 11, id: 2),
            _stop(hour: 13, id: 3, overrideVersion: 4),
          ],
          by: const Duration(minutes: 15),
        );

        expect(repository.moves[0].expectedVersion, 4);
        expect(repository.moves[1].expectedVersion, 0);
      },
    );
  });
}
