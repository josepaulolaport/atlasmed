import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/features/explore/data/clinic_detail.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

class ClinicVisitsException implements Exception {
  const ClinicVisitsException();
}

class ClinicVisitsRepository extends Repository<List<ClinicVisit>>
    with SessionEnvironmentMixin<List<ClinicVisit>> {
  ClinicVisitsRepository(this.facilityId, {RepositoryHttpClient? client})
    : _client = client,
      super(
        endpoint: Uri.parse(
          '${AppConfig.apiBaseUrl}/api/v1/facilities/$facilityId/visits',
        ),
        name: 'ClinicVisitsRepository',
      );

  final String facilityId;
  final RepositoryHttpClient? _client;

  @override
  RepositoryHttpClient get client => _client ?? super.client;

  @override
  List<ClinicVisit> fromJson(String json) {
    final decoded = jsonDecode(json) as Map<String, dynamic>;
    final data = decoded['data'] as List<dynamic>;
    return data
        .map((item) => ClinicVisit.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<ClinicVisit> createVisit({String? visitedAt}) async {
    final body = <String, dynamic>{};
    if (visitedAt != null) {
      body['visitedAt'] = visitedAt;
    }

    final response = await client.call(
      request: RepositoryHttpRequest(
        url: endpoint,
        method: RepositoryHttpMethod.post,
        headers: const {'Content-Type': 'application/json'},
        body: body,
      ),
    );

    if (!successfulCondition(response.statusCode, response.body)) {
      final shouldThrow = await onErrorStatusCode(response.statusCode);
      if (shouldThrow) {
        throw const ClinicVisitsException();
      }
    }

    final created = ClinicVisit.fromJson(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
    await refresh();
    return created;
  }
}
