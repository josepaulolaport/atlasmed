import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_summary.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:atlasmed_mobile_app/repository/domain/entities/data_source.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

class DashboardRepository extends Repository<DashboardSummary>
    with SessionEnvironmentMixin<DashboardSummary> {
  DashboardRepository({required String verticalId})
    : _verticalId = verticalId,
      super(
        endpoint: Uri.parse(
          '${AppConfig.apiBaseUrl}/api/v1/dashboard/summary',
        ).replace(queryParameters: {'verticalId': verticalId}),
        resolveOnCreate: false,
      );

  final String _verticalId;

  /// Fetches the summary for the configured vertical and emits the result
  /// into the repository stream so [RepositoryBuilder] picks it up.
  Future<DashboardSummary> fetchSummary() async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: endpoint,
        method: RepositoryHttpMethod.get,
        headers: {'X-AtlasMed-Vertical-Id': _verticalId},
      ),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        'Dashboard summary failed (${response.statusCode}): ${response.body}',
      );
    }
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    final summary = DashboardSummary.fromJson(json);
    // Push into the stream so RepositoryBuilder consumers react.
    await emit(data: summary, datasource: RepositoryDatasource.remote);
    return summary;
  }

  @override
  Future<DashboardSummary?> refresh() => fetchSummary().then((v) => v);
}
