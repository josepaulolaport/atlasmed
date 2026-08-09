import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api/professional_api.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/person_facility_role_catalog.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/professional_roster.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/doctors_repository.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

class FacilityAssociateException implements Exception {
  const FacilityAssociateException([this.message]);

  final String? message;

  @override
  String toString() => message ?? 'FacilityAssociateException';
}

/// Search / create / associate doctors against a facility.
class FacilityAssociateRepository extends Repository<PaginatedProfessionals>
    with SessionEnvironmentMixin<PaginatedProfessionals> {
  FacilityAssociateRepository(this.facilityId, {RepositoryHttpClient? client})
    : _client = client,
      super(
        endpoint: Uri.parse(
          '${AppConfig.apiBaseUrl}/api/v1/healthcare-professionals',
        ),
        name: 'FacilityAssociateRepository',
      );

  final int facilityId;
  final RepositoryHttpClient? _client;

  String get _healthcarePath =>
      '${AppConfig.apiBaseUrl}/api/v1/facilities/$facilityId'
      '/healthcare-professionals';

  @override
  RepositoryHttpClient get client => _client ?? super.client;

  @override
  PaginatedProfessionals fromJson(String json) =>
      PaginatedProfessionals.fromJson(json);

  /// Global Explorar search — `GET /healthcare-professionals`.
  Future<List<ProfessionalRoster>> searchDoctors({
    String? search,
    int limit = 40,
  }) async {
    final repo = DoctorsRepository(page: 1, limit: limit, searchQuery: search);
    try {
      final page = await repo.currentValueOrResolve();
      if (page == null) {
        throw const FacilityAssociateException('Falha ao buscar médicos');
      }
      return page.items
          .where((d) => !d.facilityIds.contains(facilityId))
          .map(_doctorFromDTO)
          .toList(growable: false);
    } finally {
      repo.dispose();
    }
  }

  /// Link an existing person as healthcare professional at this facility.
  Future<void> associateDoctor(int personId) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse(_healthcarePath),
        method: RepositoryHttpMethod.post,
        headers: const {'Content-Type': 'application/json'},
        body: {'personId': personId},
      ),
    );

    if (!successfulCondition(response.statusCode, response.body)) {
      final shouldThrow = await onErrorStatusCode(response.statusCode);
      if (shouldThrow) {
        throw FacilityAssociateException(
          'Falha ao associar médico (${response.statusCode})',
        );
      }
    }
  }

  /// `PUT …/healthcare-professionals/:personFacilityId/roles`.
  Future<ProfessionalRoster> updateDoctorRoles(
    ProfessionalRoster doctor, {
    required List<int> roleIds,
    List<PersonFacilityRoleCatalogEntry>? catalog,
  }) async {
    final personFacilityId = doctor.personFacilityId;
    if (personFacilityId == null) {
      throw const FacilityAssociateException(
        'personFacilityId é obrigatório para salvar papéis',
      );
    }

    final dto = await _putHealthcareRoles(
      personFacilityId: personFacilityId,
      roleIds: PersonFacilityRoleCatalog.sortedIds(roleIds),
    );
    final fromApi = ProfessionalRoster.fromRosterItem(dto, catalog: catalog);
    return doctor.copyWith(
      personFacilityId: fromApi.personFacilityId,
      roleIds: fromApi.roleIds,
    );
  }

  Future<FacilityProfessionalItemDTO> _putHealthcareRoles({
    required int personFacilityId,
    required List<int> roleIds,
  }) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse('$_healthcarePath/$personFacilityId/roles'),
        method: RepositoryHttpMethod.put,
        headers: const {'Content-Type': 'application/json'},
        body: {'roleIds': roleIds},
      ),
    );

    if (!successfulCondition(response.statusCode, response.body)) {
      final shouldThrow = await onErrorStatusCode(response.statusCode);
      if (shouldThrow) {
        throw FacilityAssociateException(
          'Falha ao salvar papéis (${response.statusCode})',
        );
      }
    }

    final map = jsonDecode(response.body) as Map<String, dynamic>;
    return FacilityProfessionalItemDTO.fromMap(map);
  }

  /// `DELETE …/healthcare-professionals/:personFacilityId` — soft-end affiliation.
  Future<void> endDoctorAffiliation(ProfessionalRoster doctor) async {
    final personFacilityId = doctor.personFacilityId;
    if (personFacilityId == null) {
      throw const FacilityAssociateException(
        'personFacilityId é obrigatório para encerrar vínculo',
      );
    }

    final response = await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse('$_healthcarePath/$personFacilityId'),
        method: RepositoryHttpMethod.delete,
      ),
    );

    if (!successfulCondition(response.statusCode, response.body)) {
      final shouldThrow = await onErrorStatusCode(response.statusCode);
      if (shouldThrow) {
        throw FacilityAssociateException(
          'Falha ao encerrar vínculo (${response.statusCode})',
        );
      }
    }
  }

  String get _relationshipPath => '${AppConfig.apiBaseUrl}/api/v1/persons';

  /// `PATCH /persons/:personId/relationship`.
  Future<int?> updateRelationshipLevel(
    int personId, {
    int? relationshipLevel,
  }) async {
    if (relationshipLevel == null) {
      throw const FacilityAssociateException(
        'Nível de relacionamento é obrigatório',
      );
    }

    final response = await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse('$_relationshipPath/$personId/relationship'),
        method: RepositoryHttpMethod.patch,
        headers: const {'Content-Type': 'application/json'},
        body: {'relationshipLevel': relationshipLevel},
      ),
    );

    if (!successfulCondition(response.statusCode, response.body)) {
      final shouldThrow = await onErrorStatusCode(response.statusCode);
      if (shouldThrow) {
        throw FacilityAssociateException(
          'Falha ao salvar relacionamento (${response.statusCode})',
        );
      }
    }

    final map = jsonDecode(response.body) as Map<String, dynamic>;
    final level = map['relationshipLevel'];
    if (level is num) return level.toInt();
    return relationshipLevel;
  }

  /// `GET /persons/:personId/relationship`.
  Future<int?> fetchRelationshipLevel(int personId) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse('$_relationshipPath/$personId/relationship'),
        method: RepositoryHttpMethod.get,
      ),
    );

    if (!successfulCondition(response.statusCode, response.body)) {
      await onErrorStatusCode(response.statusCode);
      return null;
    }

    final map = jsonDecode(response.body) as Map<String, dynamic>;
    final level = map['relationshipLevel'];
    if (level is num) return level.toInt();
    return null;
  }

  ProfessionalRoster _doctorFromDTO(ProfessionalDTO d) {
    final name = d.displayName;
    return ProfessionalRoster(
      id: d.id,
      name: name,
      initials: initialsFromName(name),
      hue: hueFromName(name),
      specialty: d.specialty,
    );
  }
}

/// Split a full name into first/last for person projection create.
({String firstName, String lastName}) splitPersonName(String fullName) {
  final parts = fullName.trim().split(RegExp(r'\s+'));
  if (parts.isEmpty || parts.first.isEmpty) {
    return (firstName: 'Médico', lastName: '-');
  }
  if (parts.length == 1) {
    return (firstName: parts.first, lastName: '-');
  }
  return (firstName: parts.first, lastName: parts.sublist(1).join(' '));
}
