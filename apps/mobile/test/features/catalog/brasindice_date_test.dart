import 'package:atlasmed_mobile_app/features/catalog/presentation/screens/brasindice_date.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final lastYear = DateTime(2025, 3, 14);
  final today = DateTime(2026, 8, 16);

  test('editing a variant without touching a price keeps the old date', () {
    expect(
      brasindiceDateForSave(
        existing: lastYear,
        currentPrices: const [10.0, 11.0, 12.0],
        savedPrices: const [10.0, 11.0, 12.0],
        now: today,
      ),
      lastYear,
    );
  });

  test('changing any one price stamps today', () {
    expect(
      brasindiceDateForSave(
        existing: lastYear,
        currentPrices: const [10.0, 11.0, 99.0],
        savedPrices: const [10.0, 11.0, 12.0],
        now: today,
      ),
      today,
    );
  });

  test('a new record is stamped today', () {
    expect(
      brasindiceDateForSave(
        existing: null,
        currentPrices: const [10.0],
        savedPrices: const [],
        now: today,
      ),
      today,
    );
  });

  test('a record that never had a date does not invent one from an '
      'untouched edit', () {
    expect(
      brasindiceDateForSave(
        existing: null,
        currentPrices: const [10.0],
        savedPrices: const [10.0],
        now: today,
      ),
      isNull,
    );
  });

  test('an unparseable price counts as a change rather than silently '
      'matching', () {
    expect(
      brasindiceDateForSave(
        existing: lastYear,
        currentPrices: const [null, 11.0, 12.0],
        savedPrices: const [10.0, 11.0, 12.0],
        now: today,
      ),
      today,
    );
  });
}
