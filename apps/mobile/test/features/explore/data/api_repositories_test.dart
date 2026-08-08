import 'package:flutter_test/flutter_test.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api/facility_api.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api/professional_api.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/clinics_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/doctors_repository.dart';

void main() {
  group('ClinicsRepository', () {
    test('builds a paginated search endpoint for clinics', () {
      final endpoint = ClinicsRepository.makeEndpoint(
        baseUrl: 'https://api.example.test',
        page: 2,
        limit: 15,
        searchQuery: 'Cardio Center',
      );

      expect(
        endpoint.toString(),
        'https://api.example.test/api/v1/facilities?page=2&limit=15&search=Cardio+Center',
      );
    });

    test('parses paginated clinic responses with total metadata', () {
      final result = PaginatedFacilities.fromJson('''
{
  "data": [
    {
      "id": 1,
      "name": "Clínica Central",
      "professionalCount": 7,
      "legalDocumentType": "CPF",
      "legalDocument": "12345678909",
      "territoryId": 2,
      "territoryAssignmentStatus": "assigned",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-02T00:00:00.000Z"
    }
  ],
  "pagination": {"page": 2, "limit": 15, "total": 31, "totalPages": 3}
}
''');

      expect(result.items, hasLength(1));
      expect(result.items.first.id, 1);
      expect(result.items.first.name, 'Clínica Central');
      expect(result.items.first.professionalCount, 7);
      expect(result.items.first.legalDocumentType, 'CPF');
      expect(result.items.first.legalDocument, '12345678909');
      expect(result.items.first.territoryAssignmentStatus, 'assigned');
      expect(result.pagination.total, 31);
    });
  });

  group('Clinic location mapping', () {
    test('maps neighborhood, city, and state from list responses', () {
      final clinic = FacilityDTO.fromMap({
        'id': 1,
        'name': 'Clínica Central',
        'professionalCount': 7,
        'neighborhood': 'Centro',
        'city': 'Rio de Janeiro',
        'state': 'RJ',
      });

      expect(clinic.neighborhood, 'Centro');
      expect(clinic.city, 'Rio de Janeiro');
      expect(clinic.state, 'RJ');
    });

    test('derives territoryAssignmentStatus when API omits it', () {
      final assigned = FacilityDTO.fromMap({
        'id': 1,
        'name': 'Com território',
        'professionalCount': 0,
        'territoryId': 9,
      });
      expect(assigned.territoryAssignmentStatus, 'assigned');

      final fromProfile = FacilityDTO.fromMap({
        'id': 2,
        'name': 'Perfil com território',
        'professionalCount': 0,
        'verticalProfiles': [
          {
            'verticalId': 1,
            'verticalName': 'Estética',
            'territoryId': 4,
          },
        ],
      });
      expect(fromProfile.territoryAssignmentStatus, 'assigned');

      final unassigned = FacilityDTO.fromMap({
        'id': 3,
        'name': 'Sem território',
        'professionalCount': 0,
      });
      expect(unassigned.territoryAssignmentStatus, 'unassigned');
    });
  });

  group('ClinicDetailRepository seam (FacilityDTO)', () {
    test('maps the API DTO at the repository seam', () {
      // Same parser ClinicDetailRepository.fromJson uses.
      final facility = FacilityDTO.fromJson('''
{
  "id": 1,
  "name": "Clínica Central",
  "professionalCount": 7,
  "streetAddress": "Rua das Flores",
  "streetNumber": "42",
  "city": "Rio de Janeiro",
  "state": "RJ",
  "consultantSince": "2026-01-02T00:00:00.000Z"
}
''');

      expect(facility.id, 1);
      expect(facility.name, 'Clínica Central');
      expect(facility.professionalCount, 7);
      expect(facility.streetAddress, 'Rua das Flores');
      expect(facility.consultantSince, '2026-01-02T00:00:00.000Z');
    });
  });

  group('DoctorsRepository', () {
    test(
      'builds a paginated search endpoint for doctors scoped to a facility',
      () {
        final endpoint = DoctorsRepository.makeEndpoint(
          baseUrl: 'https://api.example.test',
          page: 1,
          limit: 20,
          searchQuery: 'Ana',
          facilityId: 1,
        );

        expect(
          endpoint.toString(),
          'https://api.example.test/api/v1/healthcare-professionals?page=1&limit=20&search=Ana&facilityId=1',
        );
      },
    );

    test('parses paginated doctor responses with total metadata', () {
      final result = PaginatedProfessionals.fromJson('''
{
  "data": [
    {
      "id": 1,
      "firstName": "Ana",
      "lastName": "Silva",
      "fullName": "Ana Silva",
      "specialty": "Cardiologia",
      "facilityIds": [10],
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-02T00:00:00.000Z"
    }
  ],
  "pagination": {"page": 1, "limit": 20, "total": 42, "totalPages": 3}
}
''');

      expect(result.items, hasLength(1));
      expect(result.items.first.id, 1);
      expect(result.items.first.displayName, 'Ana Silva');
      expect(result.items.first.crm, '');
      expect(result.pagination.total, 42);
    });
  });
}
