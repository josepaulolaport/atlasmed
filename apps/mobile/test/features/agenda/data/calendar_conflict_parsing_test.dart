import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:flutter_test/flutter_test.dart';

/// The exact shape the API sends on a create conflict.
///
/// `CalendarConflictError` puts `conflicts` in the client-safe context, and
/// `conflictFrom(event, 'candidate:<idempotency-key>')` names the candidate —
/// the thing being created has no id yet, so its id is a synthetic string.
Map<String, dynamic> _createConflict() => {
  'candidateId': 'candidate:9f2c1b7a44d0',
  'existingId': 7,
  'candidateOccurrenceKey': '2026-08-15T18:30[America/Sao_Paulo]',
  'existingOccurrenceKey': '2026-08-15T19:00[America/Sao_Paulo]',
  'candidateStartsAt': '2026-08-15T21:30:00.000Z',
  'candidateEndsAt': '2026-08-15T22:30:00.000Z',
  'existingStartsAt': '2026-08-15T22:00:00.000Z',
  'existingEndsAt': '2026-08-15T23:00:00.000Z',
};

void main() {
  test('a create conflict survives its synthetic candidate id', () {
    // It did not: `readCrmId` threw on 'candidate:…', the throw was caught
    // where the whole error payload is parsed, and the conflict list came back
    // empty — so the rep saw "o horário solicitado está indisponível" while
    // the server had already said which appointment was in the way and when.
    final conflict = CalendarConflict.fromJson(_createConflict());

    expect(conflict.candidate.id, isNull);
    expect(conflict.existing.id, 7);
    expect(conflict.existing.startsAt, DateTime.utc(2026, 8, 15, 22));
    expect(conflict.existing.endsAt, DateTime.utc(2026, 8, 15, 23));
  });

  test('an occurrence key is read as no id rather than coerced into one', () {
    // Lenient is not permissive: nothing can look up a key string as an id.
    final conflict = CalendarConflict.fromJson({
      ..._createConflict(),
      'existingId': '2026-08-15T19:00[America/Sao_Paulo]',
    });

    expect(conflict.existing.id, isNull);
  });

  test('an update conflict still reads its numeric ids', () {
    final conflict = CalendarConflict.fromJson({
      ..._createConflict(),
      'candidateId': 8,
    });

    expect(conflict.candidate.id, 8);
  });
}
