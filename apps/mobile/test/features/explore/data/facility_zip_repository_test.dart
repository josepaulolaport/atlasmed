import 'dart:convert';

import 'package:atlasmed_mobile_app/features/explore/data/api/professional_api.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api_types/facility_representative_api_type.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/professional_roster.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parses flat healthcare-professionals list without pagination', () {
    final page = PaginatedFacilityProfessionals.fromJson(
      jsonEncode({
        'data': [
          {
            'personFacilityId': 10,
            'personId': 20,
            'facilityId': 1,
            'firstName': 'João',
            'lastName': 'Silva',
            'socialName': null,
            'cpf': null,
            'email': 'joao@example.com',
            'mobilePhone': '11999999999',
            'landlinePhone': null,
            'roleTitle': 'Ortopedista',
            'notes': null,
            'hasHealthcareProfile': true,
            'classificationCodes': ['HEALTHCARE_PROFESSIONAL'],
          },
        ],
      }),
    );

    expect(page.items, hasLength(1));
    expect(page.pagination.page, 1);
    expect(page.pagination.total, 1);
    expect(page.pagination.totalPages, 1);

    final roster = ProfessionalRoster.fromRosterItem(page.items.single);
    expect(roster.id, 20);
    expect(roster.personFacilityId, 10);
    expect(roster.name, 'João Silva');
    expect(roster.specialty, 'Ortopedista');
    expect(roster.email, 'joao@example.com');
  });

  test('parses flat administrative-contacts list into domain', () {
    final page = PaginatedFacilityRepresentatives.fromJson(
      jsonEncode({
        'data': [
          {
            'personFacilityId': 11,
            'personId': 21,
            'facilityId': 1,
            'firstName': 'Ana',
            'lastName': 'Costa',
            'socialName': null,
            'cpf': null,
            'email': 'ana@example.com',
            'mobilePhone': '11888888888',
            'landlinePhone': null,
            'roleTitle': 'Administradora',
            'notes': null,
            'hasHealthcareProfile': false,
            'classificationCodes': ['ADMINISTRATIVE_CONTACT'],
          },
        ],
      }),
    );

    final admin = page.items.single.toDomain();
    expect(admin.id, 11);
    expect(admin.name, 'Ana Costa');
    expect(admin.roleTitle, 'Administradora');
    expect(admin.phone, '11888888888');
    expect(page.pagination.total, 1);
  });
}
