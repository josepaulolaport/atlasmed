import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api_types/clinic_api_type.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api_types/query_builder.dart';

/// Radius chip options for Explorar clinics (km). Clear = no `radiusKm`.
const List<double> exploreRadiusKmOptions = [5, 10, 25, 50, 100];

class ClinicsRepository extends Repository<PaginatedClinics>
    with SessionEnvironmentMixin<PaginatedClinics> {
  ClinicsRepository({
    String? baseUrl,
    this.page = 1,
    this.limit = 20,
    this.searchQuery,
    this.latitude,
    this.longitude,
    this.radiusKm,
    this.commercialStatus,
    this.productIds,
    this.sort,
    this.verticalId,
    super.resolveOnCreate = false,
  }) : super(
         endpoint: buildEndpoint(
           baseUrl: baseUrl ?? AppConfig.apiBaseUrl,
           path: '/api/v1/facilities',
           queryParameters: {
             'page': page.toString(),
             'limit': limit.toString(),
             if (searchQuery != null && searchQuery.trim().isNotEmpty)
               'search': searchQuery.trim(),
             if (latitude != null) 'latitude': latitude.toString(),
             if (longitude != null) 'longitude': longitude.toString(),
             if (radiusKm != null) 'radiusKm': radiusKm.toString(),
             if (commercialStatus != null && commercialStatus.trim().isNotEmpty)
               'commercialStatus': commercialStatus.trim(),
             if (productIds != null && productIds.trim().isNotEmpty)
               'productIds': productIds.trim(),
             if (verticalId != null && verticalId.trim().isNotEmpty)
               'verticalId': verticalId.trim(),
             if (sort != null && sort.trim().isNotEmpty) 'sort': sort.trim(),
           },
         ),
         name: 'ClinicsRepository',
       );

  final int page;
  final int limit;
  final String? searchQuery;
  final double? latitude;
  final double? longitude;
  final double? radiusKm;
  final String? commercialStatus;
  final String? productIds;
  final String? sort;
  final String? verticalId;

  /// Build the endpoint URI for this repository.
  /// Calls the shared [buildEndpoint] from [query_builder.dart].
  static Uri makeEndpoint({
    required String baseUrl,
    required int page,
    required int limit,
    String? searchQuery,
    double? latitude,
    double? longitude,
    double? radiusKm,
    String? commercialStatus,
    String? productIds,
    String? sort,
    String? verticalId,
  }) {
    return buildEndpoint(
      baseUrl: baseUrl,
      path: '/api/v1/facilities',
      queryParameters: {
        'page': page.toString(),
        'limit': limit.toString(),
        if (searchQuery != null && searchQuery.trim().isNotEmpty)
          'search': searchQuery.trim(),
        if (latitude != null) 'latitude': latitude.toString(),
        if (longitude != null) 'longitude': longitude.toString(),
        if (radiusKm != null) 'radiusKm': radiusKm.toString(),
        if (commercialStatus != null && commercialStatus.trim().isNotEmpty)
          'commercialStatus': commercialStatus.trim(),
        if (productIds != null && productIds.trim().isNotEmpty)
          'productIds': productIds.trim(),
        if (verticalId != null && verticalId.trim().isNotEmpty)
          'verticalId': verticalId.trim(),
        if (sort != null && sort.trim().isNotEmpty) 'sort': sort.trim(),
      },
    );
  }

  @override
  PaginatedClinics fromJson(String json) => PaginatedClinics.fromJson(json);
}
