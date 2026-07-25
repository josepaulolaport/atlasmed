import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api_types/doctor_api_type.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api_types/query_builder.dart';

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
  /// Calls the shared [buildEndpoint] from [query_builder.dart].
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

  /// Patches a single person-level field via `PATCH /api/v1/professionals/:id`.
  /// Pass [value] `null` to clear a nullable column.
  Future<ApiDoctor> patchProfessionalField({
    required String id,
    required String fieldKey,
    required String? value,
  }) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse('${AppConfig.apiBaseUrl}/api/v1/professionals/$id'),
        method: RepositoryHttpMethod.patch,
        headers: const {'Content-Type': 'application/json'},
        body: {fieldKey: value},
      ),
    );

    if (!successfulCondition(response.statusCode, response.body)) {
      final shouldThrow = await onErrorStatusCode(response.statusCode);
      if (shouldThrow) {
        throw Exception('Falha ao atualizar médico (${response.statusCode})');
      }
    }

    final map = jsonDecode(response.body) as Map<String, dynamic>;
    return ApiDoctor.fromMap(map);
  }
}
