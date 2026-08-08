import 'package:atlasmed_mobile_app/core/json/crm_id.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('readCrmIdLoose', () {
    test('accepts int and num', () {
      expect(readCrmIdLoose(3), 3);
      expect(readCrmIdLoose(3.0), 3);
    });

    test('accepts digit string and Mapbox double string', () {
      expect(readCrmIdLoose('3'), 3);
      expect(readCrmIdLoose('3.0'), 3);
    });

    test('rejects non-whole decimals and junk', () {
      expect(readCrmIdLoose('3.5'), isNull);
      expect(readCrmIdLoose('abc'), isNull);
      expect(readCrmIdLoose(null), isNull);
    });
  });

  group('parseRouteCrmId', () {
    test('accepts integer path segments only', () {
      expect(parseRouteCrmId('3', 'facilityId'), 3);
      expect(
        () => parseRouteCrmId('3.0', 'facilityId'),
        throwsA(isA<FormatException>()),
      );
    });
  });
}
