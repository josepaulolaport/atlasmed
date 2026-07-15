import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';
import '../api_types.dart';

class ClinicsRepository extends Repository<PaginatedClinics>
    with SessionEnvironmentMixin<PaginatedClinics> {
  ClinicsRepository({
    String? baseUrl,
    this.page = 1,
    this.limit = 20,
    this.searchQuery,
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
           },
         ),
         name: 'ClinicsRepository',
       );

  final int page;
  final int limit;
  final String? searchQuery;

  /// Build the endpoint URI for this repository.
  /// Calls the shared [buildEndpoint] from api_types.dart.
  static Uri makeEndpoint({
    required String baseUrl,
    required int page,
    required int limit,
    String? searchQuery,
  }) {
    return buildEndpoint(
      baseUrl: baseUrl,
      path: '/api/v1/facilities',
      queryParameters: {
        'page': page.toString(),
        'limit': limit.toString(),
        if (searchQuery != null && searchQuery.trim().isNotEmpty)
          'search': searchQuery.trim(),
      },
    );
  }

  @override
  PaginatedClinics fromJson(String json) => PaginatedClinics.fromJson(json);
}
