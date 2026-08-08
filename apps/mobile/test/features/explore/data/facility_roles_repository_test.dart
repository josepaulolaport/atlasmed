import 'dart:convert';

import 'package:atlasmed_mobile_app/features/explore/data/domain/person_facility_role_catalog.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/professional_roster.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_associate_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_representatives_repository.dart';
import 'package:atlasmed_mobile_app/repository/base_repository.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_cache_storage.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:flutter_test/flutter_test.dart';

class FakeClient extends RepositoryHttpClient {
  FakeClient(this.responses);

  final List<RepositoryHttpResponse> responses;
  final List<RepositoryHttpRequest> requests = [];

  @override
  Future<RepositoryHttpResponse> call({
    required RepositoryHttpRequest request,
  }) async {
    requests.add(request);
    return responses.removeAt(0);
  }
}

class MemoryCacheStorage extends RepositoryCacheStorage {
  const MemoryCacheStorage();

  @override
  Future<void> clear() async {}

  @override
  Future<void> delete({required String key}) async {}

  @override
  Future<String?> read({required String key}) async => null;

  @override
  Future<void> write({required String key, required String value}) async {}
}

/// Test catalog with stable positive ids matching API wire shape.
const _testCatalog = <PersonFacilityRoleCatalogEntry>[
  PersonFacilityRoleCatalogEntry(id: 1, name: 'Prescritor'),
  PersonFacilityRoleCatalogEntry(id: 2, name: 'Comprador'),
  PersonFacilityRoleCatalogEntry(id: 3, name: 'Decisor'),
  PersonFacilityRoleCatalogEntry(id: 4, name: 'Parceiro'),
  PersonFacilityRoleCatalogEntry(id: 5, name: 'Administrador'),
  PersonFacilityRoleCatalogEntry(id: 6, name: 'Faturamento'),
  PersonFacilityRoleCatalogEntry(id: 7, name: 'Secretário(a)'),
];

Map<String, dynamic> _projection({
  required int personFacilityId,
  required List<int> roleIds,
}) => {
  'personFacilityId': personFacilityId,
  'personId': 20,
  'facilityId': 1,
  'firstName': 'João',
  'lastName': 'Silva',
  'roleTitle': 'Ortopedista',
  'roleIds': roleIds,
  'classificationIds': [1],
  'hasHealthcareProfile': true,
};

void main() {
  BaseRepository.storage = const MemoryCacheStorage();

  setUp(() {
    PersonFacilityRoleCatalogCache.replace(_testCatalog);
  });

  tearDown(PersonFacilityRoleCatalogCache.resetForTest);

  test('updateDoctorRoles PUTs roleIds and fails without personFacilityId', () async {
    final client = FakeClient([
      RepositoryHttpResponse(
        statusCode: 200,
        headers: const {},
        body: jsonEncode(
          _projection(
            personFacilityId: 10,
            roleIds: [1, 3],
          ),
        ),
      ),
    ]);
    final repo = FacilityAssociateRepository(1, client: client);

    final updated = await repo.updateDoctorRoles(
      const ProfessionalRoster(
        id: 20,
        personFacilityId: 10,
        name: 'João Silva',
        initials: 'JS',
        hue: 1,
      ),
      roleIds: [1, 3],
      catalog: _testCatalog,
    );

    expect(client.requests.single.method, RepositoryHttpMethod.put);
    expect(
      client.requests.single.url.path,
      '/api/v1/facilities/1/healthcare-professionals/10/roles',
    );
    expect(client.requests.single.body, {
      'roleIds': [1, 3],
    });
    expect(updated.roleIds, [1, 3]);
    expect(updated.roleChipLabels, ['Prescritor', 'Decisor']);

    expect(
      () => repo.updateDoctorRoles(
        const ProfessionalRoster(
          id: 20,
          name: 'Sem afiliação',
          initials: 'S',
          hue: 1,
        ),
        roleIds: [1],
      ),
      throwsA(isA<FacilityAssociateException>()),
    );
  });

  test('createAndAssociateDoctor PUTs roles after create when ids set', () async {
    final client = FakeClient([
      RepositoryHttpResponse(
        statusCode: 201,
        headers: const {},
        body: jsonEncode(
          _projection(personFacilityId: 10, roleIds: const []),
        ),
      ),
      RepositoryHttpResponse(
        statusCode: 200,
        headers: const {},
        body: jsonEncode(
          _projection(
            personFacilityId: 10,
            roleIds: [1, 2],
          ),
        ),
      ),
    ]);
    final repo = FacilityAssociateRepository(1, client: client);

    final doctor = await repo.createAndAssociateDoctor(
      firstName: 'João',
      lastName: 'Silva',
      roleIds: [1, 2],
      catalog: _testCatalog,
    );

    expect(client.requests, hasLength(2));
    expect(client.requests[0].method, RepositoryHttpMethod.post);
    expect(client.requests[0].body, {
      'firstName': 'João',
      'lastName': 'Silva',
    });
    expect(client.requests[1].method, RepositoryHttpMethod.put);
    expect(client.requests[1].body, {
      'roleIds': [1, 2],
    });
    expect(doctor.roleIds, [1, 2]);
    expect(doctor.roleChipLabels, ['Prescritor', 'Comprador']);
    expect(doctor.crm, isNull);
  });

  test('admin create then PUT roles; update replaces roles', () async {
    final createClient = FakeClient([
      RepositoryHttpResponse(
        statusCode: 201,
        headers: const {},
        body: jsonEncode({
          'personFacilityId': 11,
          'personId': 21,
          'facilityId': 1,
          'firstName': 'Ana',
          'lastName': 'Costa',
          'roleTitle': 'Admin',
          'roleIds': <int>[],
          'classificationIds': [2],
        }),
      ),
      RepositoryHttpResponse(
        statusCode: 200,
        headers: const {},
        body: jsonEncode({
          'personFacilityId': 11,
          'personId': 21,
          'facilityId': 1,
          'firstName': 'Ana',
          'lastName': 'Costa',
          'roleTitle': 'Admin',
          'roleIds': [5, 6],
          'classificationIds': [2],
        }),
      ),
    ]);
    final createRepo = FacilityRepresentativesRepository(
      1,
      client: createClient,
    );
    final created = await createRepo.create(
      firstName: 'Ana',
      lastName: 'Costa',
      roleIds: [5, 6],
    );
    expect(createClient.requests[1].method, RepositoryHttpMethod.put);
    expect(
      createClient.requests[1].url.path,
      '/api/v1/facilities/1/administrative-contacts/11/roles',
    );
    expect(createClient.requests[1].body, {
      'roleIds': [5, 6],
    });
    expect(created.roleIds, [5, 6]);
    expect(created.roleChipLabels, ['Administrador', 'Faturamento']);

    final updateClient = FakeClient([
      RepositoryHttpResponse(
        statusCode: 200,
        headers: const {},
        body: jsonEncode({
          'personFacilityId': 11,
          'personId': 21,
          'facilityId': 1,
          'firstName': 'Ana',
          'lastName': 'Costa',
          'roleTitle': 'Admin',
          'roleIds': [7],
          'classificationIds': [2],
        }),
      ),
    ]);
    final updateRepo = FacilityRepresentativesRepository(
      1,
      client: updateClient,
    );
    final updated = await updateRepo.updateRepresentative(
      representativeId: 11,
      roleIds: [7],
    );
    expect(updateClient.requests.single.method, RepositoryHttpMethod.put);
    expect(updateClient.requests.single.body, {
      'roleIds': [7],
    });
    expect(updated.roleIds, [7]);
    expect(updated.roleChipLabels, ['Secretário(a)']);
  });

  test('endDoctorAffiliation DELETEs affiliation and requires personFacilityId', () async {
    final client = FakeClient([
      RepositoryHttpResponse(
        statusCode: 200,
        headers: const {},
        body: jsonEncode({
          'personFacilityId': 10,
          'endedAt': '2026-08-07T12:00:00.000Z',
        }),
      ),
    ]);
    final repo = FacilityAssociateRepository(1, client: client);

    await repo.endDoctorAffiliation(
      const ProfessionalRoster(
        id: 20,
        personFacilityId: 10,
        name: 'João Silva',
        initials: 'JS',
        hue: 1,
      ),
    );

    expect(client.requests.single.method, RepositoryHttpMethod.delete);
    expect(
      client.requests.single.url.path,
      '/api/v1/facilities/1/healthcare-professionals/10',
    );

    expect(
      () => repo.endDoctorAffiliation(
        const ProfessionalRoster(
          id: 20,
          name: 'Sem afiliação',
          initials: 'S',
          hue: 1,
        ),
      ),
      throwsA(isA<FacilityAssociateException>()),
    );
  });

  test('endAffiliation DELETEs administrative contact path', () async {
    final client = FakeClient([
      RepositoryHttpResponse(
        statusCode: 200,
        headers: const {},
        body: jsonEncode({
          'personFacilityId': 11,
          'endedAt': '2026-08-07T12:00:00.000Z',
        }),
      ),
    ]);
    final repo = FacilityRepresentativesRepository(1, client: client);

    await repo.endAffiliation(11);

    expect(client.requests.single.method, RepositoryHttpMethod.delete);
    expect(
      client.requests.single.url.path,
      '/api/v1/facilities/1/administrative-contacts/11',
    );
  });
}
