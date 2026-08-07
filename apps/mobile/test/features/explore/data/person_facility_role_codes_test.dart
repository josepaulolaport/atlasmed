import 'package:atlasmed_mobile_app/features/explore/data/domain/person_facility_role_codes.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/professional_roster.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api/professional_api.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api_types/facility_representative_api_type.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('HealthcareRoleCodes', () {
    test('maps flags to codes and back', () {
      final codes = HealthcareRoleCodes.fromFlags(
        isPartner: true,
        isPrescriber: true,
        isBuyer: false,
        isDecisionMaker: true,
      );
      expect(codes, ['PARTNER', 'PRESCRIBER', 'DECISION_MAKER']);

      final flags = HealthcareRoleCodes.toFlags(codes);
      expect(flags.isPartner, isTrue);
      expect(flags.isPrescriber, isTrue);
      expect(flags.isBuyer, isFalse);
      expect(flags.isDecisionMaker, isTrue);
    });

    test('parses roleCodes on facility healthcare projection into roster', () {
      final dto = FacilityProfessionalItemDTO.fromMap({
        'personFacilityId': 10,
        'personId': 20,
        'facilityId': 1,
        'firstName': 'João',
        'lastName': 'Silva',
        'roleTitle': 'Ortopedista',
        'roleCodes': ['PRESCRIBER', 'BUYER'],
        'classificationCodes': ['HEALTHCARE_PROFESSIONAL'],
      });

      final roster = ProfessionalRoster.fromRosterItem(dto);
      expect(roster.isPrescriber, isTrue);
      expect(roster.isBuyer, isTrue);
      expect(roster.isPartner, isFalse);
      expect(roster.isDecisionMaker, isFalse);
      expect(roster.roleBadge, isNull);
    });
  });

  group('AdministrativeRoleCodes', () {
    test('maps flags to codes and back', () {
      final codes = AdministrativeRoleCodes.fromFlags(
        isPartner: false,
        isAdministrator: true,
        isDecisionMaker: true,
        isBuyer: false,
        isBiller: true,
        isSecretary: false,
      );
      expect(codes, ['ADMINISTRATOR', 'DECISION_MAKER', 'BILLER']);

      final flags = AdministrativeRoleCodes.toFlags([
        'administrator',
        'DECISION_MAKER',
        'BILLER',
      ]);
      expect(flags.isAdministrator, isTrue);
      expect(flags.isDecisionMaker, isTrue);
      expect(flags.isBiller, isTrue);
      expect(flags.isPartner, isFalse);
    });

    test('parses roleCodes into administrative domain', () {
      final admin = FacilityRepresentativeApi.fromMap({
        'personFacilityId': 11,
        'personId': 21,
        'facilityId': 1,
        'firstName': 'Ana',
        'lastName': 'Costa',
        'roleTitle': 'Administradora',
        'roleCodes': ['PARTNER', 'SECRETARY'],
        'classificationCodes': ['ADMINISTRATIVE_CONTACT'],
      }).toDomain();

      expect(admin.isPartner, isTrue);
      expect(admin.isSecretary, isTrue);
      expect(admin.isAdministrator, isFalse);
      expect(admin.roleChipLabels, ['Sócio', 'Secretária']);
    });
  });
}
