import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api/professional_api.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api_types/query_builder.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/person_facility_role_catalog.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/professional_roster.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/person_facility_roles_catalog_repository.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

class FacilityProfessionalsException implements Exception {
  const FacilityProfessionalsException();
}

/// Healthcare professionals affiliated with a facility.
///
/// Source: `GET /api/v1/facilities/:id/healthcare-professionals`
/// (flat projection list; pagination synthesized client-side).
class FacilityProfessionalsRepository
    extends Repository<PaginatedFacilityProfessionals>
    with SessionEnvironmentMixin<PaginatedFacilityProfessionals> {
  FacilityProfessionalsRepository(
    this.facilityId, {
    this.page = 1,
    this.limit = 20,
    // Kept for call-site compatibility; projection list has no view filter.
    this.view = 'all',
    this.search,
    RepositoryHttpClient? client,
  }) : _client = client,
       super(
         endpoint: buildEndpoint(
           baseUrl: AppConfig.apiBaseUrl,
           path: '/api/v1/facilities/$facilityId/healthcare-professionals',
           queryParameters: const {},
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
    // Warm id→name catalog cache so roleChipLabels resolve.
    List<PersonFacilityRoleCatalogEntry>? catalog;
    final catalogRepo = PersonFacilityRolesCatalogRepository(client: _client);
    try {
      catalog = await catalogRepo.listActive();
    } catch (_) {
      // Labels stay empty until a roles sheet loads catalog.
    } finally {
      catalogRepo.dispose();
    }
    var items = result.items
        .map(
          (item) => ProfessionalRoster.fromRosterItem(item, catalog: catalog),
        )
        .toList(growable: false);
    final q = search?.trim();
    if (q != null && q.isNotEmpty) {
      final lower = q.toLowerCase();
      items = items
          .where((d) => d.name.toLowerCase().contains(lower))
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
}
