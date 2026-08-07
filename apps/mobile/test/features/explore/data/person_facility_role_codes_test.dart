import 'package:atlasmed_mobile_app/features/explore/data/domain/person_facility_role_codes.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('PersonFacilityRoleCodes', () {
    test('normalize uppercases and dedupes', () {
      expect(
        PersonFacilityRoleCodes.normalize(['prescriber', 'BUYER', 'buyer']),
        {'PRESCRIBER', 'BUYER'},
      );
    });

    test('sortedList is stable', () {
      expect(
        PersonFacilityRoleCodes.sortedList(['SECRETARY', 'BUYER', 'PARTNER']),
        ['BUYER', 'PARTNER', 'SECRETARY'],
      );
    });

    test('fallbackName matches seed labels', () {
      expect(PersonFacilityRoleCodes.fallbackName('PARTNER'), 'Parceiro');
      expect(PersonFacilityRoleCodes.fallbackName('BILLER'), 'Faturamento');
    });
  });
}
