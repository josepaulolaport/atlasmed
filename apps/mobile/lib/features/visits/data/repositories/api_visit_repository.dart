import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment.dart';
import 'package:atlasmed_mobile_app/features/visits/data/repositories/visit_repository.dart';
import 'package:atlasmed_mobile_app/features/visits/data/weekly_visit_summary.dart';
import 'package:atlasmed_mobile_app/repository/external/http_repository_http_client.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';

class ApiVisitRepository implements VisitRepository {
  ApiVisitRepository({RepositoryHttpClient? client})
    : _client = client ?? HttpRepositoryHttpClient(tokenBuilder: SessionEnvironment.instance.tokenBuilder);

  final RepositoryHttpClient _client;

  @override
  Future<WeeklyVisitSummary> getWeeklySummary() async {
    final response = await _client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse('${AppConfig.apiBaseUrl}/api/v1/visits/weekly-summary'),
        method: RepositoryHttpMethod.get,
        headers: const {'Content-Type': 'application/json'},
      ),
    );
    if (response.statusCode != 200) {
      throw StateError('Não foi possível carregar o resumo semanal de visitas.');
    }
    return WeeklyVisitSummary.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
  }
}
