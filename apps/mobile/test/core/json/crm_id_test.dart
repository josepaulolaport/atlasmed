import 'package:atlasmed_mobile_app/core/json/crm_id.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('readCrmId', () {
    test('accepts int', () {
      expect(readCrmId(1), 1);
      expect(readCrmId(42), 42);
      expect(readCrmId(1553221), 1553221);
    });

    test('accepts integral num (JSON double-shaped)', () {
      expect(readCrmId(1.0), 1);
      expect(readCrmId(42.0), 42);
    });

    // Phase B will reject silent truncate of non-integral nums / strings.
    test('currently truncates non-integral num (Phase B target: reject)', () {
      expect(readCrmId(12.9), 12);
    });

    test('rejects string, null, and non-numbers', () {
      expect(() => readCrmId('1'), throwsA(isA<FormatException>()));
      expect(() => readCrmId(null), throwsA(isA<FormatException>()));
      expect(() => readCrmId(<String, Object>{}), throwsA(isA<FormatException>()));
      expect(() => readCrmId(<Object>[]), throwsA(isA<FormatException>()));
    });
  });

  group('readCrmIdOrNull', () {
    test('null → null; valid → int; invalid non-null → throws', () {
      expect(readCrmIdOrNull(null), isNull);
      expect(readCrmIdOrNull(7), 7);
      expect(() => readCrmIdOrNull('7'), throwsA(isA<FormatException>()));
    });
  });

  group('readCrmIdList', () {
    test('maps list of numbers to List<int>', () {
      expect(readCrmIdList([1, 2, 3]), <int>[1, 2, 3]);
    });

    test('null → empty list', () {
      expect(readCrmIdList(null), isEmpty);
    });

    test('rejects non-list and invalid members', () {
      expect(() => readCrmIdList('1,2'), throwsA(isA<FormatException>()));
      expect(() => readCrmIdList([1, '2']), throwsA(isA<FormatException>()));
    });
  });

  group('parseRouteCrmId', () {
    test('accepts integer path segments', () {
      expect(parseRouteCrmId('1'), 1);
      expect(parseRouteCrmId('123456', 'facilityId'), 123456);
    });

    test('rejects empty, decimal, and junk', () {
      expect(() => parseRouteCrmId(''), throwsA(isA<FormatException>()));
      expect(
        () => parseRouteCrmId('1.0', 'facilityId'),
        throwsA(isA<FormatException>()),
      );
      expect(() => parseRouteCrmId('abc'), throwsA(isA<FormatException>()));
      expect(() => parseRouteCrmId('12x'), throwsA(isA<FormatException>()));
    });
  });

  group('parseRouteCrmIdOrNull', () {
    test('null/empty → null; valid segment → int', () {
      expect(parseRouteCrmIdOrNull(null), isNull);
      expect(parseRouteCrmIdOrNull(''), isNull);
      expect(parseRouteCrmIdOrNull('9'), 9);
    });
  });

  group('readCrmIdLoose', () {
    test('accepts int, integral num, digit string, Mapbox double string', () {
      expect(readCrmIdLoose(3), 3);
      expect(readCrmIdLoose(3.0), 3);
      expect(readCrmIdLoose('3'), 3);
      expect(readCrmIdLoose('3.0'), 3);
    });

    test('rejects non-whole string decimals and junk', () {
      expect(readCrmIdLoose('3.5'), isNull);
      expect(readCrmIdLoose('abc'), isNull);
      expect(readCrmIdLoose(null), isNull);
      expect(readCrmIdLoose(<Object>[]), isNull);
      expect(readCrmIdLoose(<String, Object>{}), isNull);
    });

    // Phase B hardens num path (currently truncates 3.5 → 3).
    test('currently truncates non-integral num (Phase B target: null)', () {
      expect(readCrmIdLoose(3.5), 3);
    });
  });
}
