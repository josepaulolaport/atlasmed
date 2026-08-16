import 'package:atlasmed_mobile_app/features/catalog/data/models/support_catalog.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parses a row, treating blank extra as absent', () {
    // The second column is unique where present on every one of these tables,
    // so `""` would make two uncoded rows collide where two nulls would not.
    expect(
      SupportCatalogEntry.fromJson({
        'id': 4,
        'name': 'Ortopedia',
        'isActive': true,
        'extra': '  0142 ',
      }).extra,
      '0142',
    );
    expect(
      SupportCatalogEntry.fromJson({
        'id': 4,
        'name': 'Ortopedia',
        'isActive': true,
        'extra': '   ',
      }).extra,
      isNull,
    );
    expect(
      SupportCatalogEntry.fromJson({
        'id': 4,
        'name': 'Ortopedia',
        'isActive': false,
      }).isActive,
      isFalse,
    );
  });

  test('reads a numeric extra as text', () {
    // `healthcare_specialties.cnes_id` is a bigint. The API normalises it to a
    // string; this is the belt to that braces, so a contract slip is a display
    // quirk rather than a cast that takes down the list.
    expect(
      SupportCatalogEntry.fromJson({
        'id': 9,
        'name': 'Ortopedia',
        'isActive': true,
        'extra': 223119,
      }).extra,
      '223119',
    );
  });

  test('each catalogue points at the endpoint that exists', () {
    // These paths are appended to `/api/v1/` verbatim, so a typo is a 404 at
    // runtime and nothing else would catch it.
    expect(
      SupportCatalog.healthcareSpecialties.path,
      'healthcare-specialties',
    );
    expect(
      SupportCatalog.clinicalFocuses.path,
      'facilities/clinical-focuses',
    );
    expect(SupportCatalog.personFacilityRoles.path, 'person-facility-roles');
    expect(
      SupportCatalog.professionalCouncils.path,
      'person-professional-registration-councils',
    );
  });

  test('the new-entry label agrees in gender with the noun', () {
    // Found on the simulator: the FAB read "Novo especialidade".
    expect(SupportCatalog.healthcareSpecialties.newLabel, 'Nova especialidade');
    expect(SupportCatalog.clinicalFocuses.newLabel, 'Novo foco clínico');
    expect(SupportCatalog.personFacilityRoles.newLabel, 'Novo papel');
    expect(SupportCatalog.professionalCouncils.newLabel, 'Novo conselho');
  });

  test('only the councils require their second field', () {
    // `person_professional_registration_councils.abbreviation` is NOT NULL;
    // `clinical_focuses.cnes_code` is nullable, and roles have no second column
    // at all.
    expect(SupportCatalog.professionalCouncils.extraRequired, isTrue);
    expect(SupportCatalog.professionalCouncils.extraLabel, 'Sigla');
    expect(SupportCatalog.clinicalFocuses.extraRequired, isFalse);
    expect(SupportCatalog.clinicalFocuses.extraLabel, 'Código CNES');
    expect(SupportCatalog.personFacilityRoles.extraLabel, isNull);
  });

  test('a specialty may be created without a CNES id', () {
    // Migration `0117` made `cnes_id` nullable with a partial-unique index, so
    // adding a specialty CNES does not list no longer means inventing an
    // official id — the trap spec 0013 §2 removed from the product codes.
    expect(SupportCatalog.healthcareSpecialties.extraRequired, isFalse);
    expect(SupportCatalog.healthcareSpecialties.extraLabel, 'ID CNES');
    expect(SupportCatalog.values.length, 4);
  });
}
