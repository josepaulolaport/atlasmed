import 'dart:convert';

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

Map<String, dynamic> _projection({
  required int personFacilityId,
  required List<String> roleCodes,
}) => {
  'personFacilityId': personFacilityId,
  'personId': 20,
  'facilityId': 1,
  'firstName': 'João',
  'lastName': 'Silva',
  'roleTitle': 'Ortopedista',
  'roleCodes': roleCodes,
  'classificationCodes': ['HEALTHCARE_PROFESSIONAL'],
  'hasHealthcareProfile': true,
};

void main() {
  BaseRepository.storage = const MemoryCacheStorage();

  test('updateDoctorRoles PUTs roleCodes and fails without personFacilityId', () async {
    final client = FakeClient([
      RepositoryHttpResponse(
        statusCode: 200,
        headers: const {},
        body: jsonEncode(
          _projection(
            personFacilityId: 10,
            roleCodes: ['PRESCRIBER', 'DECISION_MAKER'],
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
      isPartner: false,
      isPrescriber: true,
      isBuyer: false,
      isDecisionMaker: true,
    );

    expect(client.requests.single.method, RepositoryHttpMethod.put);
    expect(
      client.requests.single.url.path,
      '/api/v1/facilities/1/healthcare-professionals/10/roles',
    );
    expect(client.requests.single.body, {
      'roleCodes': ['PRESCRIBER', 'DECISION_MAKER'],
    });
    expect(updated.isPrescriber, isTrue);
    expect(updated.isDecisionMaker, isTrue);
    expect(updated.roleBadge, 'DECISOR');

    expect(
      () => repo.updateDoctorRoles(
        const ProfessionalRoster(
          id: 20,
          name: 'Sem afiliação',
          initials: 'S',
          hue: 1,
        ),
        isPartner: false,
        isPrescriber: true,
        isBuyer: false,
        isDecisionMaker: false,
      ),
      throwsA(isA<FacilityAssociateException>()),
    );
  });

  test('createAndAssociateDoctor PUTs roles after create when flags set', () async {
    final client = FakeClient([
      RepositoryHttpResponse(
        statusCode: 201,
        headers: const {},
        body: jsonEncode(
          _projection(personFacilityId: 10, roleCodes: const []),
        ),
      ),
      RepositoryHttpResponse(
        statusCode: 200,
        headers: const {},
        body: jsonEncode(
          _projection(
            personFacilityId: 10,
            roleCodes: ['PRESCRIBER', 'BUYER'],
          ),
        ),
      ),
    ]);
    final repo = FacilityAssociateRepository(1, client: client);

    final doctor = await repo.createAndAssociateDoctor(
      firstName: 'João',
      lastName: 'Silva',
      isPrescriber: true,
      isBuyer: true,
    );

    expect(client.requests, hasLength(2));
    expect(client.requests[0].method, RepositoryHttpMethod.post);
    expect(client.requests[1].method, RepositoryHttpMethod.put);
    expect(client.requests[1].body, {
      'roleCodes': ['PRESCRIBER', 'BUYER'],
    });
    expect(doctor.isPrescriber, isTrue);
    expect(doctor.isBuyer, isTrue);
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
          'roleCodes': <String>[],
          'classificationCodes': ['ADMINISTRATIVE_CONTACT'],
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
          'roleCodes': ['ADMINISTRATOR', 'BILLER'],
          'classificationCodes': ['ADMINISTRATIVE_CONTACT'],
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
      isAdministrator: true,
      isBiller: true,
    );
    expect(createClient.requests[1].method, RepositoryHttpMethod.put);
    expect(
      createClient.requests[1].url.path,
      '/api/v1/facilities/1/administrative-contacts/11/roles',
    );
    expect(created.isAdministrator, isTrue);
    expect(created.isBiller, isTrue);

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
          'roleCodes': ['SECRETARY'],
          'classificationCodes': ['ADMINISTRATIVE_CONTACT'],
        }),
      ),
    ]);
    final updateRepo = FacilityRepresentativesRepository(
      1,
      client: updateClient,
    );
    final updated = await updateRepo.updateRepresentative(
      representativeId: 11,
      isSecretary: true,
    );
    expect(updateClient.requests.single.method, RepositoryHttpMethod.put);
    expect(updateClient.requests.single.body, {
      'roleCodes': ['SECRETARY'],
    });
    expect(updated.isSecretary, isTrue);
  });
}
