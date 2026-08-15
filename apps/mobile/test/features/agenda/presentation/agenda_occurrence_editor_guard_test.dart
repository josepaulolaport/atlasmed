import 'package:atlasmed_mobile_app/features/agenda/presentation/guards/agenda_route_guards.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('recurrenceKeyLocalDate', () {
    test('dates the appointment from the key the URL already carries', () {
      // Recovery lists that day and finds the occurrence again, which is what
      // saves an edit from the router dropping `extra` mid-session.
      expect(
        recurrenceKeyLocalDate('2026-08-15T14:30[America/Sao_Paulo]'),
        DateTime(2026, 8, 15),
      );
      expect(
        recurrenceKeyLocalDate('2026-01-02T00:00[Etc/UTC]'),
        DateTime(2026, 1, 2),
      );
    });

    test('returns null for anything that is not a key', () {
      expect(recurrenceKeyLocalDate(''), isNull);
      expect(recurrenceKeyLocalDate('nonsense'), isNull);
    });
  });
}
