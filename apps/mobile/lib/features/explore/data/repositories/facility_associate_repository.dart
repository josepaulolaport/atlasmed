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

  Future<ProfessionalRoster> createAndAssociateDoctor({
    required String firstName,
    required String lastName,
    String? specialty,
    String? crmNumber,
    String? crmState,
    String? phone,
    String? email,
    List<int>? roleIds,
    List<PersonFacilityRoleCatalogEntry>? catalog,
  }) async {
    // Specialty → roleTitle (affiliation label). CRM → crmNumber/crmState
    // (primary person_professional_registrations). Roles → PUT …/roles after.
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse(_healthcarePath),
        method: RepositoryHttpMethod.post,
        headers: const {'Content-Type': 'application/json'},
        body: {
          'firstName': firstName,
          'lastName': lastName,
          if (phone != null && phone.isNotEmpty) 'mobilePhone': phone,
          if (email != null && email.isNotEmpty) 'email': email,
          if (specialty != null && specialty.isNotEmpty) 'roleTitle': specialty,
          if (crmNumber != null && crmNumber.isNotEmpty) 'crmNumber': crmNumber,
          if (crmState != null && crmState.isNotEmpty) 'crmState': crmState,
        },
      ),
    );

    if (!successfulCondition(response.statusCode, response.body)) {
      final shouldThrow = await onErrorStatusCode(response.statusCode);
      if (shouldThrow) {
        throw FacilityAssociateException(
          'Falha ao criar médico (${response.statusCode})',
        );
      }
    }

    final map = jsonDecode(response.body) as Map<String, dynamic>;
    var dto = FacilityProfessionalItemDTO.fromMap(map);
    final ids = PersonFacilityRoleCatalog.sortedIds(roleIds ?? const []);
    if (ids.isNotEmpty) {
      try {
        dto = await _putHealthcareRoles(
          personFacilityId: dto.personFacilityId,
          roleIds: ids,
        );
      } on FacilityAssociateException {
        throw const FacilityAssociateException(
          'Médico criado, mas falhou ao salvar papéis — edite os papéis e tente de novo',
        );
      }
    }

    final roster = ProfessionalRoster.fromRosterItem(dto, catalog: catalog);
    return roster.copyWith(
      specialty: specialty ?? roster.specialty,
      crm: _formatCrm(crmNumber, crmState) ?? roster.crm,
      phone: phone ?? roster.phone,
      email: email ?? roster.email,
    );
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

  String get _relationshipPath =>
      '${AppConfig.apiBaseUrl}/api/v1/persons';

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
      crm: d.crm.isEmpty ? null : d.crm,
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

/// Best-effort CRM parse from free text like `CRM/SP 74.127`.
({String? number, String? state}) parseCrmField(String? raw) {
  if (raw == null) return (number: null, state: null);
  final trimmed = raw.trim();
  if (trimmed.isEmpty) return (number: null, state: null);

  final stateMatch = RegExp(
    r'(?:CRM[/\-\s]?)?([A-Z]{2})\b',
    caseSensitive: false,
  ).firstMatch(trimmed);
  final state = stateMatch?.group(1)?.toUpperCase();

  final digits = trimmed.replaceAll(RegExp(r'\D'), '');
  if (digits.isEmpty) {
    return (number: trimmed, state: state);
  }
  return (number: digits, state: state);
}

String? _formatCrm(String? number, String? state) {
  final n = number?.trim();
  if (n == null || n.isEmpty) return null;
  final s = state?.trim();
  if (s == null || s.isEmpty) return 'CRM $n';
  return 'CRM/$s $n';
}
