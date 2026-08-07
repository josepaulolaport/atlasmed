import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api/professional_api.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api_types/query_builder.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_recurrence.dart';

class DoctorsRepository extends Repository<PaginatedProfessionals>
    with SessionEnvironmentMixin<PaginatedProfessionals> {
  DoctorsRepository({
    String? baseUrl,
    String? cacheTag,
    this.page = 1,
    this.limit = 20,
    this.searchQuery,
    this.facilityId,
    this.latitude,
    this.longitude,
    this.radiusKm,
    this.specialty,
    this.sort,
    this.order,
  }) : super(
         endpoint: buildEndpoint(
           baseUrl: baseUrl ?? AppConfig.apiBaseUrl,
           path: '/api/v1/professionals',
           queryParameters: {
             'page': page.toString(),
             'limit': limit.toString(),
             if (searchQuery != null && searchQuery.trim().isNotEmpty)
               'search': searchQuery.trim(),
             if (facilityId != null && facilityId > 0)
               'facilityId': facilityId.toString(),
             if (latitude != null) 'latitude': latitude.toString(),
             if (longitude != null) 'longitude': longitude.toString(),
             if (radiusKm != null) 'radiusKm': radiusKm.toString(),
             if (specialty != null && specialty.trim().isNotEmpty)
               'specialty': specialty.trim(),
             if (sort != null) 'sort': sort.apiValue,
             if (order != null) 'order': order.name,
           },
         ),
         name: 'DoctorsRepository',
         tag: cacheTag,
       );

  final int page;
  final int limit;
  final String? searchQuery;
  final int? facilityId;
  final double? latitude;
  final double? longitude;
  final double? radiusKm;
  final String? specialty;
  final FacilitySort? sort;
  final SortOrder? order;

  /// Build the endpoint URI for this repository.
  /// Calls the shared [buildEndpoint] from [query_builder.dart].
  static Uri makeEndpoint({
    required String baseUrl,
    required int page,
    required int limit,
    String? searchQuery,
    int? facilityId,
    double? latitude,
    double? longitude,
    double? radiusKm,
    String? specialty,
    FacilitySort? sort,
    SortOrder? order,
  }) {
    return buildEndpoint(
      baseUrl: baseUrl,
      path: '/api/v1/professionals',
      queryParameters: {
        'page': page.toString(),
        'limit': limit.toString(),
        if (searchQuery != null && searchQuery.trim().isNotEmpty)
          'search': searchQuery.trim(),
        if (facilityId != null && facilityId > 0)
          'facilityId': facilityId.toString(),
        if (latitude != null) 'latitude': latitude.toString(),
        if (longitude != null) 'longitude': longitude.toString(),
        if (radiusKm != null) 'radiusKm': radiusKm.toString(),
        if (specialty != null && specialty.trim().isNotEmpty)
          'specialty': specialty.trim(),
        if (sort != null) 'sort': sort.apiValue,
        if (order != null) 'order': order.name,
      },
    );
  }

  @override
  PaginatedProfessionals fromJson(String json) =>
      PaginatedProfessionals.fromJson(json);

  /// Patches a single person-level field via `PATCH /api/v1/professionals/:id`.
  /// Pass [value] `null` to clear a nullable column.
  Future<ProfessionalDTO> patchProfessionalField({
    required int id,
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
    return ProfessionalDTO.fromMap(map);
  }
}
