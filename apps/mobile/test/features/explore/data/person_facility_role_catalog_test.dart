import 'package:atlasmed_mobile_app/features/explore/data/domain/person_facility_role_catalog.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('PersonFacilityRoleCatalog', () {
    test('sortedIds dedupes and sorts', () {
      expect(PersonFacilityRoleCatalog.sortedIds([3, 1, 3, 2]), [1, 2, 3]);
    });

    test('labelsFor resolves names via catalog id', () {
      const catalog = [
        PersonFacilityRoleCatalogEntry(id: 10, name: 'Prescritor'),
        PersonFacilityRoleCatalogEntry(id: 11, name: 'Comprador'),
      ];
      expect(
        PersonFacilityRoleCatalog.labelsFor([11, 10], catalog),
        ['Prescritor', 'Comprador'],
      );
      expect(PersonFacilityRoleCatalog.labelsFor([99], catalog), isEmpty);
    });

    test('activeNames skips inactive and sorts', () {
      const catalog = [
        PersonFacilityRoleCatalogEntry(id: 2, name: 'Zebra', isActive: true),
        PersonFacilityRoleCatalogEntry(id: 1, name: 'Alpha', isActive: false),
        PersonFacilityRoleCatalogEntry(id: 3, name: 'Beta', isActive: true),
      ];
      expect(
        PersonFacilityRoleCatalog.activeNames(catalog),
        ['Beta', 'Zebra'],
      );
    });

    test('idsForNames maps selected chip labels to ids', () {
      const catalog = [
        PersonFacilityRoleCatalogEntry(id: 10, name: 'Prescritor'),
        PersonFacilityRoleCatalogEntry(id: 11, name: 'Comprador'),
      ];
      expect(
        PersonFacilityRoleCatalog.idsForNames(['Comprador'], catalog),
        {11},
      );
    });

    test('catalog entry parses id/name/isActive without code', () {
      final entry = PersonFacilityRoleCatalogEntry.fromMap({
        'id': 4,
        'name': 'Parceiro',
        'isActive': false,
      });
      expect(entry.id, 4);
      expect(entry.name, 'Parceiro');
      expect(entry.isActive, isFalse);
    });

    test('cache starts empty and replace accepts empty', () {
      PersonFacilityRoleCatalogCache.resetForTest();
      expect(PersonFacilityRoleCatalogCache.entries, isEmpty);
      PersonFacilityRoleCatalogCache.replace(const [
        PersonFacilityRoleCatalogEntry(id: 1, name: 'Prescritor'),
      ]);
      expect(PersonFacilityRoleCatalogCache.entries, hasLength(1));
      PersonFacilityRoleCatalogCache.replace(const []);
      expect(PersonFacilityRoleCatalogCache.entries, isEmpty);
    });
  });
}
