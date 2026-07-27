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
      "id": "clinic-1",
      "name": "Clínica Central",
      "professionalCount": 7,
      "taxIdType": "PF",
      "cpf": "12345678909",
      "territoryId": "territory-1",
      "territoryAssignmentStatus": "assigned",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-02T00:00:00.000Z"
    }
  ],
  "pagination": {"page": 2, "limit": 15, "total": 31, "totalPages": 3}
}
''');

      expect(result.items, hasLength(1));
      expect(result.items.first.id, 'clinic-1');
      expect(result.items.first.name, 'Clínica Central');
      expect(result.items.first.professionalCount, 7);
      expect(result.items.first.taxIdType, 'PF');
      expect(result.items.first.cpf, '12345678909');
      expect(result.pagination.total, 31);
    });
  });

  group('Clinic location mapping', () {
    test('maps neighborhood, city, and state from list responses', () {
      final clinic = FacilityDTO.fromMap({
        'id': 'clinic-1',
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
          facilityId: 'clinic-1',
        );

        expect(
          endpoint.toString(),
          'https://api.example.test/api/v1/professionals?page=1&limit=20&search=Ana&facilityId=clinic-1',
        );
      },
    );

    test('parses paginated doctor responses with total metadata', () {
      final result = PaginatedProfessionals.fromJson('''
{
  "data": [
    {
      "id": "doctor-1",
      "firstName": "Ana",
      "lastName": "Silva",
      "fullName": "Ana Silva",
      "specialty": "Cardiologia",
      "crmNumber": "123456",
      "crmState": "SP",
      "facilityIds": ["clinic-1"],
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-02T00:00:00.000Z"
    }
  ],
  "pagination": {"page": 1, "limit": 20, "total": 42, "totalPages": 3}
}
''');

      expect(result.items, hasLength(1));
      expect(result.items.first.id, 'doctor-1');
      expect(result.items.first.displayName, 'Ana Silva');
      expect(result.items.first.crm, 'CRM-SP 123456');
      expect(result.pagination.total, 42);
    });
  });
}
