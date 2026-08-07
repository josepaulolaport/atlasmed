import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api/professional_api.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api_types/query_builder.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/professional_roster.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

class FacilityProfessionalsException implements Exception {
  const FacilityProfessionalsException();
}

/// Paginated CRM doctors associated with a facility.
///
/// Relationship stars come from `association.relationshipLevel`
/// (`user_professional_relationships` for the authenticated user).
class FacilityProfessionalsRepository
    extends Repository<PaginatedFacilityProfessionals>
    with SessionEnvironmentMixin<PaginatedFacilityProfessionals> {
  FacilityProfessionalsRepository(
    this.facilityId, {
    this.page = 1,
    this.limit = 20,
    // `all` = source-active CNES links + confirmed CRM rows. Local/imported
    // data is almost entirely unconfirmed (`confirmed_at` null), so
    // `confirmed` alone leaves the Médicos strip empty while Explorar search
    // still shows the same doctors via Meili `activeFacilityIds`.
    this.view = 'all',
    this.search,
    RepositoryHttpClient? client,
  }) : _client = client,
       super(
         endpoint: buildEndpoint(
           baseUrl: AppConfig.apiBaseUrl,
           path: '/api/v1/facilities/$facilityId/professionals',
           queryParameters: {
             'page': '$page',
             'limit': '$limit',
             'view': view,
             if (search != null && search.trim().isNotEmpty)
               'search': search.trim(),
           },
         ),
         name: 'FacilityProfessionalsRepository',
       );

  final int facilityId;
  final int page;
  final int limit;
  final String view;
  final String? search;
  final RepositoryHttpClient? _client;

  @override
  RepositoryHttpClient get client => _client ?? super.client;

  @override
  PaginatedFacilityProfessionals fromJson(String json) =>
      PaginatedFacilityProfessionals.fromJson(json);

  Future<FacilityRosterPage<ProfessionalRoster>> loadPage() async {
    final result = await currentValueOrResolve();
    if (result == null) {
      throw const FacilityProfessionalsException();
    }
    return FacilityRosterPage(
      items: result.items
          .map((item) => ProfessionalRoster.fromRosterItem(item))
          .toList(growable: false),
      pagination: result.pagination,
    );
  }
}
