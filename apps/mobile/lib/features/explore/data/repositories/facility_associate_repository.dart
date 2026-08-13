import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api/professional_api.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/cnes_suggestions.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/person_facility_role_catalog.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/professional_roster.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/doctors_repository.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

/// What an import produced: the person, and whether they were already ours.
class CnesImportResult {
  const CnesImportResult({
    required this.personId,
    required this.alreadyExisted,
  });

  final int personId;

  /// The council registration was already held, so no record was created.
  final bool alreadyExisted;
}

/// A bigint id arrives as a number or a string depending on the encoder.
int? _asInt(Object? value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value.trim());
  return null;
}

Map<String, dynamic> _decodeMap(String body) {
  try {
    final decoded = jsonDecode(body);
    return decoded is Map<String, dynamic> ? decoded : const {};
  } catch (_) {
    // A malformed body is a failure to report, not an exception to leak from a
    // parse call — the caller turns an empty map into its own error.
    return const {};
  }
}

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

  /// Professionals CNES associates with this clinic that we already hold and
  /// that are not linked here yet — `GET …/healthcare-professionals/cnes-suggestions`.
  ///
  /// The exclusion of already-linked people happens server-side (spec 0012
  /// AC 3), as it does in [searchDoctors].
  Future<CnesSuggestions> fetchCnesSuggestions() async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse('$_healthcarePath/cnes-suggestions'),
        method: RepositoryHttpMethod.get,
      ),
    );

    if (!successfulCondition(response.statusCode, response.body)) {
      final shouldThrow = await onErrorStatusCode(response.statusCode);
      if (shouldThrow) {
        throw FacilityAssociateException(
          'Falha ao buscar sugestões do CNES (${response.statusCode})',
        );
      }
      return CnesSuggestions.unavailable();
    }

    return CnesSuggestions.fromMap(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
  }

  /// Candidates to associate here — `GET /healthcare-professionals`, with the
  /// people already working at this clinic excluded by the server.
  ///
  /// `excludeFacilityId` rather than a `.where` over the result: the filter has
  /// to run before `LIMIT` or it removes rows without replacing them, and the
  /// page comes back short by however many of this clinic's own doctors
  /// happened to rank inside it. There is no second page here, so those
  /// candidates are simply unreachable — and a short list looks exactly like a
  /// complete one.
  Future<List<ProfessionalRoster>> searchDoctors({
    String? search,
    int limit = 40,
  }) async {
    /*
     * Through `client.call`, like every other method here.
     *
     * It used to build a `DoctorsRepository` and resolve it, which pulled in
     * the cache and `SessionEnvironment` for what is a one-shot, debounced,
     * already-scoped query — nothing was reused across calls, and the injected
     * client did not reach it, so this one request went around the seam the
     * others honour.
     */
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: DoctorsRepository.makeEndpoint(
          baseUrl: AppConfig.apiBaseUrl,
          page: 1,
          limit: limit,
          searchQuery: search,
          excludeFacilityId: facilityId,
        ),
        method: RepositoryHttpMethod.get,
      ),
    );

    if (!successfulCondition(response.statusCode, response.body)) {
      final shouldThrow = await onErrorStatusCode(response.statusCode);
      if (shouldThrow) {
        throw FacilityAssociateException(
          'Falha ao buscar médicos (${response.statusCode})',
        );
      }
      return const [];
    }

    final page = PaginatedProfessionals.fromMap(_decodeMap(response.body));
    return page.items.map(_doctorFromDTO).toList(growable: false);
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

  /// Outcome of importing one CNES professional.
  ///
  /// [alreadyExisted] is not an error path. The server refuses to create a
  /// second record for a council registration somebody already holds and
  /// returns that person instead, so this is the ordinary answer to "import
  /// them" when we turn out to have had them all along.
  ///
  /// The rep is told afterwards rather than asked beforehand: of 1 039
  /// confirmed-same people, five disagree on spelling and none is a different
  /// human, so a confirmation would be answered yes every time and would train
  /// people to tap through it.
  Future<CnesImportResult> importCnesProfessional({
    required String professionalCnesId,
    String? firstName,
    String? lastName,
  }) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse('$_healthcarePath/cnes-imports'),
        method: RepositoryHttpMethod.post,
        headers: const {'Content-Type': 'application/json'},
        body: {
          'professionalCnesId': professionalCnesId,
          if (firstName != null && firstName.trim().isNotEmpty)
            'firstName': firstName.trim(),
          if (lastName != null && lastName.trim().isNotEmpty)
            'lastName': lastName.trim(),
        },
      ),
    );

    if (response.statusCode == 409) {
      // The registration belongs to someone we already hold. The payload
      // carries their id precisely so this resolves instead of failing.
      final body = _decodeMap(response.body);
      final personId = _asInt(body['personId']);
      if (personId != null) {
        return CnesImportResult(personId: personId, alreadyExisted: true);
      }
    }

    if (!successfulCondition(response.statusCode, response.body)) {
      final shouldThrow = await onErrorStatusCode(response.statusCode);
      if (shouldThrow) {
        throw FacilityAssociateException(
          'Falha ao importar profissional (${response.statusCode})',
        );
      }
      throw const FacilityAssociateException('Falha ao importar profissional');
    }

    final body = _decodeMap(response.body);
    final personId = _asInt(body['personId']);
    if (personId == null) {
      throw const FacilityAssociateException(
        'Importação não retornou o profissional criado',
      );
    }
    return CnesImportResult(
      personId: personId,
      alreadyExisted: body['created'] == false,
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
      // The API already resolves primary-or-first and preformats it
      // (`CRM/SP 123456`); dropping it here is why the pool rows showed a
      // specialty and no registration while every other surface showed both.
      crm: d.primaryRegistrationDisplay,
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
