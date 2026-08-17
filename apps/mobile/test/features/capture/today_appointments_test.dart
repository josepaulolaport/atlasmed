import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/capture/presentation/today_appointments_card.dart';
import 'package:flutter_test/flutter_test.dart';

CalendarOccurrence _visit({
  required int hour,
  String status = 'SCHEDULED',
  int id = 1,
  bool personalBlock = false,
  DateTime? actualStartedAt,
  DateTime? actualEndedAt,
}) => CalendarOccurrence.fromJson({
  'id': '$id:key-$hour',
  'calendarId': id,
  'recurrenceKey': 'key-$hour',
  'ownerUserId': 2,
  'kind': personalBlock ? 'PERSONAL_BLOCK' : 'INTERACTION',
  'title': 'Visita $hour',
  'startsAt': DateTime(2026, 8, 16, hour).toUtc().toIso8601String(),
  'endsAt': DateTime(2026, 8, 16, hour + 1).toUtc().toIso8601String(),
  'timeZone': 'America/Sao_Paulo',
  'durationMinutes': 60,
  'recurrence': 'NONE',
  'version': 1,
  'canMutate': true,
  if (!personalBlock)
    'interaction': {
      'id': id,
      'facilityId': 9,
      'status': status,
      'version': 3,
      if (actualStartedAt != null)
        'actualStartedAt': actualStartedAt.toUtc().toIso8601String(),
      if (actualEndedAt != null)
        'actualEndedAt': actualEndedAt.toUtc().toIso8601String(),
    },
});

void main() {
  group('appointmentsForTheDay', () {
    test('keeps what has already been recorded', () {
      // It used to drop them, so a visit vanished from the card the moment the
      // rep closed it — the thing they had just done disappearing reads as a
      // record that failed. A day is also something you look back at.
      final rows = appointmentsForTheDay([
        _visit(hour: 9, status: 'COMPLETED', id: 1),
        _visit(hour: 16, id: 2),
      ]);

      expect(rows.map((r) => r.interaction!.id), [1, 2]);
    });

    test('keeps a personal block that occupies the day', () {
      // It carries no interaction and offers no action, but it is why the rep
      // has less time than they think.
      final rows = appointmentsForTheDay([
        _visit(hour: 16, id: 1, personalBlock: true),
      ]);

      expect(rows, hasLength(1));
      expect(rows.single.interaction, isNull);
    });

    test('reads in the order the day happens', () {
      final rows = appointmentsForTheDay([
        _visit(hour: 18, id: 2),
        _visit(hour: 16, id: 1),
      ]);

      expect(rows.map((r) => r.interaction!.id), [1, 2]);
    });

    test('orders a started visit by when it actually started', () {
      // A visit booked for 16:00 that the rep walked into at 09:10 belongs
      // where it happened. Sorting by the plan would put it after a 10:00 one
      // it in fact preceded.
      final rows = appointmentsForTheDay([
        _visit(hour: 10, id: 2),
        _visit(
          hour: 16,
          id: 1,
          status: 'COMPLETED',
          actualStartedAt: DateTime(2026, 8, 16, 9, 10),
          actualEndedAt: DateTime(2026, 8, 16, 9, 45),
        ),
      ]);

      expect(rows.map((r) => r.interaction!.id), [1, 2]);
    });
  });

  test('the list DTO carries the interaction version', () {
    // Starting or finishing from the card needs an expectedVersion without
    // opening the visit first; the model used to drop the field the API sends.
    expect(_visit(hour: 16).interaction!.version, 3);
  });
}
