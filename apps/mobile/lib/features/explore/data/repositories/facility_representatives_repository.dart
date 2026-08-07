import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api_types/facility_representative_api_type.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api_types/query_builder.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

class FacilityRepresentativesException implements Exception {
  const FacilityRepresentativesException([this.message]);

  final String? message;

  @override
  String toString() => message ?? 'FacilityRepresentativesException';
}

/// Paginated CRM administrative professionals for a facility.
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
           path: '/api/v1/facilities/$facilityId/representatives',
           queryParameters: {
             'page': '$page',
             'limit': '$limit',
             if (search != null && search.trim().isNotEmpty)
               'search': search.trim(),
           },
         ),
         name: 'FacilityRepresentativesRepository',
       );

  final int facilityId;
  final int page;
  final int limit;
  final String? search;
  final RepositoryHttpClient? _client;

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
    return FacilityRosterPage(
      items: result.items
          .map((item) => item.toDomain())
          .toList(growable: false),
      pagination: result.pagination,
    );
  }

  Future<AdministrativeProfessional> create({
    required String representativeName,
    String? roleTitle,
    String? email,
    String? phone,
    bool isPartner = false,
    bool isAdministrator = false,
    bool isDecisionMaker = false,
    bool isBuyer = false,
    bool isBiller = false,
    bool isSecretary = false,
  }) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse(
          '${AppConfig.apiBaseUrl}/api/v1/facilities/$facilityId/representatives',
        ),
        method: RepositoryHttpMethod.post,
        headers: const {'Content-Type': 'application/json'},
        body: {
          'representativeName': representativeName,
          if (roleTitle != null && roleTitle.isNotEmpty) 'roleTitle': roleTitle,
          if (email != null && email.isNotEmpty) 'email': email,
          if (phone != null && phone.isNotEmpty) 'phone': phone,
          'isPartner': isPartner,
          'isAdministrator': isAdministrator,
          'isDecisionMaker': isDecisionMaker,
          'isBuyer': isBuyer,
          'isBiller': isBiller,
          'isSecretary': isSecretary,
        },
      ),
    );

    return _parseMutationResponse(response, 'criar');
  }

  Future<AdministrativeProfessional> updateRepresentative({
    required int representativeId,
    String? representativeName,
    String? roleTitle,
    String? email,
    String? phone,
    bool? isPartner,
    bool? isAdministrator,
    bool? isDecisionMaker,
    bool? isBuyer,
    bool? isBiller,
    bool? isSecretary,
    int? relationshipLevel,
    bool clearRelationshipLevel = false,
  }) async {
    final body = <String, Object?>{
      'representativeName': ?representativeName,
      'roleTitle': ?roleTitle,
      'email': ?email,
      'phone': ?phone,
      'isPartner': ?isPartner,
      'isAdministrator': ?isAdministrator,
      'isDecisionMaker': ?isDecisionMaker,
      'isBuyer': ?isBuyer,
      'isBiller': ?isBiller,
      'isSecretary': ?isSecretary,
      if (clearRelationshipLevel)
        'relationshipLevel': null
      else
        'relationshipLevel': ?relationshipLevel,
    };

    final response = await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse(
          '${AppConfig.apiBaseUrl}/api/v1/facilities/$facilityId/representatives/$representativeId',
        ),
        method: RepositoryHttpMethod.patch,
        headers: const {'Content-Type': 'application/json'},
        body: body,
      ),
    );

    return _parseMutationResponse(response, 'atualizar');
  }

  AdministrativeProfessional _parseMutationResponse(
    RepositoryHttpResponse response,
    String action,
  ) {
    if (!successfulCondition(response.statusCode, response.body)) {
      throw FacilityRepresentativesException(
        'Falha ao $action profissional (${response.statusCode})',
      );
    }

    final map = jsonDecode(response.body) as Map<String, dynamic>;
    return FacilityRepresentativeApi.fromMap(map).toDomain();
  }
}
