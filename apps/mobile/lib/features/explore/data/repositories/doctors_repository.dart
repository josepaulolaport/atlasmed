import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api_types.dart';

class DoctorsRepository extends Repository<PaginatedDoctors>
    with SessionEnvironmentMixin<PaginatedDoctors> {
  DoctorsRepository({
    String? baseUrl,
    this.page = 1,
    this.limit = 20,
    this.searchQuery,
    this.facilityId,
    this.latitude,
    this.longitude,
    this.radiusKm,
    this.specialty,
    super.resolveOnCreate = false,
  }) : super(
         endpoint: buildEndpoint(
           baseUrl: baseUrl ?? AppConfig.apiBaseUrl,
           path: '/api/v1/professionals',
           queryParameters: {
             'page': page.toString(),
             'limit': limit.toString(),
             if (searchQuery != null && searchQuery.trim().isNotEmpty)
               'search': searchQuery.trim(),
             if (facilityId != null && facilityId.trim().isNotEmpty)
               'facilityId': facilityId.trim(),
             if (latitude != null) 'latitude': latitude.toString(),
             if (longitude != null) 'longitude': longitude.toString(),
             if (radiusKm != null) 'radiusKm': radiusKm.toString(),
             if (specialty != null && specialty.trim().isNotEmpty)
               'specialty': specialty.trim(),
           },
         ),
         name: 'DoctorsRepository',
       );

  final int page;
  final int limit;
  final String? searchQuery;
  final String? facilityId;
  final double? latitude;
  final double? longitude;
  final double? radiusKm;
  final String? specialty;

  /// Build the endpoint URI for this repository.
  /// Calls the shared [buildEndpoint] from api_types.dart.
  static Uri makeEndpoint({
    required String baseUrl,
    required int page,
    required int limit,
    String? searchQuery,
    String? facilityId,
    double? latitude,
    double? longitude,
    double? radiusKm,
    String? specialty,
  }) {
    return buildEndpoint(
      baseUrl: baseUrl,
      path: '/api/v1/professionals',
      queryParameters: {
        'page': page.toString(),
        'limit': limit.toString(),
        if (searchQuery != null && searchQuery.trim().isNotEmpty)
          'search': searchQuery.trim(),
        if (facilityId != null && facilityId.trim().isNotEmpty)
          'facilityId': facilityId.trim(),
        if (latitude != null) 'latitude': latitude.toString(),
        if (longitude != null) 'longitude': longitude.toString(),
        if (radiusKm != null) 'radiusKm': radiusKm.toString(),
        if (specialty != null && specialty.trim().isNotEmpty)
          'specialty': specialty.trim(),
      },
    );
  }

  @override
  PaginatedDoctors fromJson(String json) => PaginatedDoctors.fromJson(json);
}
