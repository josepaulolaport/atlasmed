import 'package:atlasmed_mobile_app/features/explore/data/domain/healthcare_specialty.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/person_facility_role_catalog.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/professional_registration.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/screens/cnes_import_wizard.dart';

/// The catalogues the import wizard needs, without the network.
///
/// Shared between the sheet's test and the wizard's own: the sheet pushes the
/// wizard, so mounting it there loads these too, and two copies of the fixture
/// would drift the moment either grew a row.
CnesImportCatalogues testCatalogues({
  List<HealthcareSpecialty>? specialties,
  List<PersonFacilityRoleCatalogEntry>? roles,
  List<ProfessionalRegistrationCouncil>? councils,
  Future<List<HealthcareSpecialty>> Function()? onSpecialties,
}) => (
  specialties:
      onSpecialties ??
      () async =>
          specialties ??
          const [
            HealthcareSpecialty(id: 1, name: 'Ortopedia'),
            HealthcareSpecialty(id: 2, name: 'Cardiologia'),
          ],
  roles: () async =>
      roles ??
      const [
        PersonFacilityRoleCatalogEntry(id: 1, name: 'Prescritor'),
        PersonFacilityRoleCatalogEntry(id: 2, name: 'Decisor'),
      ],
  councils: () async =>
      councils ??
      const [
        ProfessionalRegistrationCouncil(
          id: 1,
          name: 'Conselho Regional de Medicina',
          abbreviation: 'CRM',
        ),
      ],
);
