import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api_types/facility_representative_api_type.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api_types/query_builder.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/person_facility_role_codes.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

class FacilityRepresentativesException implements Exception {
  const FacilityRepresentativesException([this.message]);

  final String? message;

  @override
  String toString() => message ?? 'FacilityRepresentativesException';
}

/// Administrative contacts for a facility.
///
/// Source: `GET|POST|PATCH /api/v1/facilities/:id/administrative-contacts`
class FacilityRepresentativesRepository
    extends Repository<PaginatedFacilityRepresentatives>
    with SessionEnvironmentMixin<PaginatedFacilityRepresentatives> {
  FacilityRepresentativesRepository(
    this.facilityId, {
    this.page = 1,
    this.limit = 20,
    this.search,
    RepositoryHttpClient? client,
  }) : _client = client,
       super(
         endpoint: buildEndpoint(
           baseUrl: AppConfig.apiBaseUrl,
           path: '/api/v1/facilities/$facilityId/administrative-contacts',
           queryParameters: const {},
         ),
         name: 'FacilityRepresentativesRepository',
       );

  final int facilityId;
  final int page;
  final int limit;
  final String? search;
  final RepositoryHttpClient? _client;

  String get _contactsPath =>
      '${AppConfig.apiBaseUrl}/api/v1/facilities/$facilityId'
      '/administrative-contacts';

  @override
  RepositoryHttpClient get client => _client ?? super.client;

  @override
  PaginatedFacilityRepresentatives fromJson(String json) =>
      PaginatedFacilityRepresentatives.fromJson(json);

  Future<FacilityRosterPage<AdministrativeProfessional>> loadPage() async {
    final result = await currentValueOrResolve();
    if (result == null) {
      throw const FacilityRepresentativesException();
    }
    var items = result.items
        .map((item) => item.toDomain())
        .toList(growable: false);
    final q = search?.trim();
    if (q != null && q.isNotEmpty) {
      final lower = q.toLowerCase();
      items = items
          .where((p) => p.name.toLowerCase().contains(lower))
          .toList(growable: false);
    }
    return FacilityRosterPage(
      items: items,
      pagination: Pagination(
        page: 1,
        limit: items.length,
        total: items.length,
        totalPages: 1,
      ),
    );
  }

  Future<AdministrativeProfessional> create({
    required String firstName,
    required String lastName,
    String? roleTitle,
    String? email,
    String? mobilePhone,
    List<String>? roleCodes,
    bool isPartner = false,
    bool isAdministrator = false,
    bool isDecisionMaker = false,
    bool isBuyer = false,
    bool isBiller = false,
    bool isSecretary = false,
  }) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse(_contactsPath),
        method: RepositoryHttpMethod.post,
        headers: const {'Content-Type': 'application/json'},
        body: {
          'firstName': firstName,
          'lastName': lastName,
          if (roleTitle != null && roleTitle.isNotEmpty) 'roleTitle': roleTitle,
          if (email != null && email.isNotEmpty) 'email': email,
          if (mobilePhone != null && mobilePhone.isNotEmpty)
            'mobilePhone': mobilePhone,
        },
      ),
    );

    var api = _parseMutationApi(response, 'criar');
    final codes = PersonFacilityRoleCodes.sortedList(
      roleCodes ??
          [
            if (isPartner) PersonFacilityRoleCodes.partner,
            if (isAdministrator) PersonFacilityRoleCodes.administrator,
            if (isDecisionMaker) PersonFacilityRoleCodes.decisionMaker,
            if (isBuyer) PersonFacilityRoleCodes.buyer,
            if (isBiller) PersonFacilityRoleCodes.biller,
            if (isSecretary) PersonFacilityRoleCodes.secretary,
          ],
    );
    if (codes.isNotEmpty) {
      try {
        api = await _putAdminRoles(
          personFacilityId: api.personFacilityId,
          roleCodes: codes,
        );
      } on FacilityRepresentativesException {
        throw const FacilityRepresentativesException(
          'Contato criado, mas falhou ao salvar papéis — edite os papéis e tente de novo',
        );
      }
    }
    return api.toDomain();
  }

  /// [representativeId] is `personFacilityId` (domain [AdministrativeProfessional.id]).
  Future<AdministrativeProfessional> updateRepresentative({
    required int representativeId,
    String? firstName,
    String? lastName,
    String? roleTitle,
    String? email,
    String? mobilePhone,
    List<String>? roleCodes,
    int? relationshipLevel,
    bool clearRelationshipLevel = false,
  }) async {
    // Relationship score has no administrative-contacts field.
    // Former user_representative_relationships PATCH is gone — fail closed
    // so UI (representative_detail_screen) reverts optimistic local state.
    final rolesProvided = roleCodes != null;
    final onlyRelationship =
        firstName == null &&
        lastName == null &&
        roleTitle == null &&
        email == null &&
        mobilePhone == null &&
        !rolesProvided &&
        (relationshipLevel != null || clearRelationshipLevel);
    if (onlyRelationship) {
      throw const FacilityRepresentativesException(
        'Relacionamento de contato administrativo ainda não disponível',
      );
    }

    final onlyRoles =
        firstName == null &&
        lastName == null &&
        roleTitle == null &&
        email == null &&
        mobilePhone == null &&
        rolesProvided;
    FacilityRepresentativeApi api;
    if (onlyRoles) {
      api = await _putAdminRoles(
        personFacilityId: representativeId,
        roleCodes: PersonFacilityRoleCodes.sortedList(roleCodes),
      );
    } else {
      final body = <String, Object?>{
        if (firstName != null) 'firstName': firstName,
        if (lastName != null) 'lastName': lastName,
        if (roleTitle != null) 'roleTitle': roleTitle,
        if (email != null) 'email': email,
        if (mobilePhone != null) 'mobilePhone': mobilePhone,
      };

      final response = await client.call(
        request: RepositoryHttpRequest(
          url: Uri.parse('$_contactsPath/$representativeId'),
          method: RepositoryHttpMethod.patch,
          headers: const {'Content-Type': 'application/json'},
          body: body,
        ),
      );

      api = _parseMutationApi(response, 'atualizar');
      if (roleCodes != null) {
        try {
          api = await _putAdminRoles(
            personFacilityId: representativeId,
            roleCodes: PersonFacilityRoleCodes.sortedList(roleCodes),
          );
        } on FacilityRepresentativesException {
          throw const FacilityRepresentativesException(
            'Dados salvos, mas falhou ao salvar papéis — edite os papéis e tente de novo',
          );
        }
      }
    }

    return api.toDomain();
  }

  Future<FacilityRepresentativeApi> _putAdminRoles({
    required int personFacilityId,
    required List<String> roleCodes,
  }) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse('$_contactsPath/$personFacilityId/roles'),
        method: RepositoryHttpMethod.put,
        headers: const {'Content-Type': 'application/json'},
        body: {'roleCodes': roleCodes},
      ),
    );
    return _parseMutationApi(response, 'salvar papéis de');
  }

  /// `DELETE …/administrative-contacts/:personFacilityId` — soft-end affiliation.
  Future<void> endAffiliation(int personFacilityId) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse('$_contactsPath/$personFacilityId'),
        method: RepositoryHttpMethod.delete,
      ),
    );

    if (!successfulCondition(response.statusCode, response.body)) {
      final shouldThrow = await onErrorStatusCode(response.statusCode);
      if (shouldThrow) {
        throw FacilityRepresentativesException(
          'Falha ao encerrar vínculo (${response.statusCode})',
        );
      }
    }
  }

  FacilityRepresentativeApi _parseMutationApi(
    RepositoryHttpResponse response,
    String action,
  ) {
    if (!successfulCondition(response.statusCode, response.body)) {
      throw FacilityRepresentativesException(
        'Falha ao $action profissional (${response.statusCode})',
      );
    }

    final map = jsonDecode(response.body) as Map<String, dynamic>;
    return FacilityRepresentativeApi.fromMap(map);
  }
}
