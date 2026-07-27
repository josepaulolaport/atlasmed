import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api/professional_api.dart';
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
        endpoint: Uri.parse('${AppConfig.apiBaseUrl}/api/v1/professionals'),
        name: 'FacilityAssociateRepository',
      );

  final String facilityId;
  final RepositoryHttpClient? _client;

  @override
  RepositoryHttpClient get client => _client ?? super.client;

  @override
  PaginatedProfessionals fromJson(String json) =>
      PaginatedProfessionals.fromJson(json);

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

  Future<void> associateDoctor(String professionalId) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse(
          '${AppConfig.apiBaseUrl}/api/v1/facilities/$facilityId'
          '/professionals/$professionalId/associate',
        ),
        method: RepositoryHttpMethod.post,
        headers: const {'Content-Type': 'application/json'},
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
    bool isPrescriber = false,
    bool isBuyer = false,
    bool isDecisionMaker = false,
  }) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse('${AppConfig.apiBaseUrl}/api/v1/professionals'),
        method: RepositoryHttpMethod.post,
        headers: const {'Content-Type': 'application/json'},
        body: {
          'firstName': firstName,
          'lastName': lastName,
          if (specialty != null && specialty.isNotEmpty)
            'primarySpecialtyLabel': specialty,
          if (crmNumber != null && crmNumber.isNotEmpty) 'crmNumber': crmNumber,
          if (crmState != null && crmState.isNotEmpty) 'crmState': crmState,
          if (phone != null && phone.isNotEmpty) 'mobilePhone': phone,
          if (email != null && email.isNotEmpty) 'email': email,
          'facilityIds': [facilityId],
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
    final dto = ProfessionalDTO.fromMap(map);

    final needsRolePatch = isPrescriber || isBuyer || isDecisionMaker;
    if (needsRolePatch) {
      await _patchRoles(
        dto.id,
        isPrescriber: isPrescriber,
        isBuyer: isBuyer,
        isDecisionMaker: isDecisionMaker,
      );
    }

    final name = dto.displayName;
    return ProfessionalRoster(
      id: dto.id,
      name: name,
      initials: initialsFromName(name),
      hue: hueFromName(name),
      specialty: specialty ?? dto.specialty,
      crm: dto.crm.isEmpty ? null : dto.crm,
      phone: phone ?? dto.phone,
      email: email ?? dto.email,
      isPrescriber: isPrescriber,
      isBuyer: isBuyer,
      isDecisionMaker: isDecisionMaker,
      roleBadge: isDecisionMaker ? 'DECISOR' : null,
    );
  }

  Future<void> _patchRoles(
    String professionalId, {
    bool isPartner = false,
    required bool isPrescriber,
    required bool isBuyer,
    required bool isDecisionMaker,
    bool throwOnError = false,
  }) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse(
          '${AppConfig.apiBaseUrl}/api/v1/facilities/$facilityId'
          '/professionals/$professionalId',
        ),
        method: RepositoryHttpMethod.patch,
        headers: const {'Content-Type': 'application/json'},
        body: {
          'isPartner': isPartner,
          'isPrescriber': isPrescriber,
          'isBuyer': isBuyer,
          'isDecisionMaker': isDecisionMaker,
        },
      ),
    );

    if (!successfulCondition(response.statusCode, response.body)) {
      if (throwOnError) {
        throw FacilityAssociateException(
          'Falha ao salvar papel (${response.statusCode})',
        );
      }
      // Association already exists; role flags are best-effort on create.
      await onErrorStatusCode(response.statusCode);
    }
  }

  /// Updates facility-scoped role flags for an associated doctor.
  Future<ProfessionalRoster> updateDoctorRoles(
    ProfessionalRoster doctor, {
    required bool isPartner,
    required bool isPrescriber,
    required bool isBuyer,
    required bool isDecisionMaker,
  }) async {
    await _patchRoles(
      doctor.id,
      isPartner: isPartner,
      isPrescriber: isPrescriber,
      isBuyer: isBuyer,
      isDecisionMaker: isDecisionMaker,
      throwOnError: true,
    );

    return doctor.copyWith(
      isPartner: isPartner,
      isPrescriber: isPrescriber,
      isBuyer: isBuyer,
      isDecisionMaker: isDecisionMaker,
      roleBadge: isDecisionMaker ? 'DECISOR' : null,
      clearRoleBadge: !isDecisionMaker,
    );
  }

  /// User×professional relationship (1–10). Null clears the score.
  Future<int?> updateRelationshipLevel(
    String professionalId, {
    int? relationshipLevel,
  }) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse(
          '${AppConfig.apiBaseUrl}/api/v1/facilities/$facilityId'
          '/professionals/$professionalId',
        ),
        method: RepositoryHttpMethod.patch,
        headers: const {'Content-Type': 'application/json'},
        body: {'relationshipLevel': relationshipLevel},
      ),
    );

    if (!successfulCondition(response.statusCode, response.body)) {
      throw FacilityAssociateException(
        'Falha ao salvar relacionamento (${response.statusCode})',
      );
    }

    final map = jsonDecode(response.body) as Map<String, dynamic>;
    final value = map['relationshipLevel'];
    if (value is int) return value;
    if (value is num) return value.toInt();
    return null;
  }

  /// Current association context including the caller's relationship score.
  Future<int?> fetchRelationshipLevel(String professionalId) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse(
          '${AppConfig.apiBaseUrl}/api/v1/facilities/$facilityId'
          '/professionals/$professionalId',
        ),
        method: RepositoryHttpMethod.get,
      ),
    );

    if (!successfulCondition(response.statusCode, response.body)) {
      return null;
    }

    final map = jsonDecode(response.body) as Map<String, dynamic>;
    final association = map['association'];
    if (association is! Map) return null;
    final value = association['relationshipLevel'];
    if (value is int) return value;
    if (value is num) return value.toInt();
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

/// Split a full name into first/last for `POST /professionals`.
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
