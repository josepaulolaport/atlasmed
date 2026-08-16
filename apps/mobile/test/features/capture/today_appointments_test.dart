import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/capture/presentation/today_appointments_card.dart';
import 'package:flutter_test/flutter_test.dart';

final _now = DateTime(2026, 8, 16, 14);

CalendarOccurrence _visit({
  required int hour,
  String status = 'SCHEDULED',
  int id = 1,
  bool personalBlock = false,
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
    'interaction': {'id': id, 'facilityId': 9, 'status': status, 'version': 3},
});

void main() {
  group('appointmentsStillAhead', () {
    test('drops what has already been recorded', () {
      // A card still listing this morning's finished visit at five in the
      // afternoon is noise.
      final rows = appointmentsStillAhead([
        _visit(hour: 9, status: 'COMPLETED', id: 1),
        _visit(hour: 16, id: 2),
      ], _now);

      expect(rows.map((r) => r.interaction!.id), [2]);
    });

    test('keeps a visit in progress whatever the clock says', () {
      // It is the one the rep is standing in, and the only one they can end.
      final rows = appointmentsStillAhead([
        _visit(hour: 9, status: 'IN_PROGRESS', id: 1),
      ], _now);

      expect(rows, hasLength(1));
    });

    test('drops a visit whose window has closed unstarted', () {
      // It is not ahead any more; the overdue job will call it NOT_COMPLETED.
      final rows = appointmentsStillAhead([_visit(hour: 9, id: 1)], _now);

      expect(rows, isEmpty);
    });

    test('drops a cancelled visit', () {
      final rows = appointmentsStillAhead([
        _visit(hour: 16, status: 'CANCELLED', id: 1),
      ], _now);

      expect(rows, isEmpty);
    });

    test('keeps a personal block that still occupies the day', () {
      // It carries no interaction and offers no action, but it is why the rep
      // has less time left than they think.
      final rows = appointmentsStillAhead([
        _visit(hour: 16, id: 1, personalBlock: true),
      ], _now);

      expect(rows, hasLength(1));
      expect(rows.single.interaction, isNull);
    });

    test('reads top to bottom in the order the day happens', () {
      final rows = appointmentsStillAhead([
        _visit(hour: 18, id: 2),
        _visit(hour: 16, id: 1),
      ], _now);

      expect(rows.map((r) => r.interaction!.id), [1, 2]);
    });
  });

  test('the list DTO carries the interaction version', () {
    // Starting or finishing from the card needs an expectedVersion without
    // opening the visit first; the model used to drop the field the API sends.
    expect(_visit(hour: 16).interaction!.version, 3);
  });
}
