import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_summary.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

class DashboardRepository extends Repository<DashboardSummary>
    with SessionEnvironmentMixin<DashboardSummary> {
  DashboardRepository()
    : super(
        endpoint: Uri.parse('${AppConfig.apiBaseUrl}/api/v1/dashboard/summary'),
      );

  Future<DashboardSummary> fetchSummary({required String verticalId}) async {
    final uri = endpoint.replace(queryParameters: {'verticalId': verticalId});
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: uri,
        method: RepositoryHttpMethod.get,
        headers: {'X-AtlasMed-Vertical-Id': verticalId},
      ),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        'Dashboard summary failed (${response.statusCode}): ${response.body}',
      );
    }
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return DashboardSummary.fromJson(json);
  }
}
