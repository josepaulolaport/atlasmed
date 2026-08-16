import 'package:atlasmed_mobile_app/features/explore/presentation/tax_identifier.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('formatPostalCode', () {
    test('punctuates an eight-digit CEP, like the document beside it', () {
      expect(formatPostalCode('22775001'), '22775-001');
    });

    test('accepts one that is already punctuated', () {
      expect(formatPostalCode('22775-001'), '22775-001');
    });

    test('leaves anything that is not a CEP alone rather than mangling it', () {
      // Better a raw value than '1234-5' invented out of a partial one.
      expect(formatPostalCode('12345'), '12345');
      expect(formatPostalCode('sem cep'), 'sem cep');
    });

    test('empty and null are absent, not an empty string', () {
      expect(formatPostalCode(null), isNull);
      expect(formatPostalCode('   '), isNull);
    });
  });
}
