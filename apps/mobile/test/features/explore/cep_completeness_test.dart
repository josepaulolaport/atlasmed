import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_geocoding_repository.dart';
import 'package:flutter_test/flutter_test.dart';

/// Found by dragging the pin one block on a real clinic in Barra da Tijuca.
///
/// Mapbox answered that point with `22775` — the five-digit prefix, not a CEP —
/// and the form took it verbatim, replacing the `22775-001` already on file.
/// Moving the pin therefore *lost* a correct value, and on an accepted
/// suggestion that loss would have reached the clinic record.
void main() {
  test('accepts a CEP with and without the hyphen', () {
    expect(isCompleteCep('22775-001'), isTrue);
    expect(isCompleteCep('22775001'), isTrue);
    expect(isCompleteCep('  22270-010  '), isTrue);
  });

  test('rejects the five-digit prefix Mapbox returns for some points', () {
    expect(isCompleteCep('22775'), isFalse);
  });

  test('rejects absent, empty and malformed values', () {
    expect(isCompleteCep(null), isFalse);
    expect(isCompleteCep(''), isFalse);
    expect(isCompleteCep('2277-5001'), isFalse);
    expect(isCompleteCep('227750012'), isFalse);
    expect(isCompleteCep('abcde-fgh'), isFalse);
  });
}
