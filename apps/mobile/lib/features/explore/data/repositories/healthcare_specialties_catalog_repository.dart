import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/healthcare_specialty.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

/// The specialty catalogue with ids — `GET /api/v1/healthcare-specialties`.
class HealthcareSpecialtiesCatalogRepository
    extends Repository<List<HealthcareSpecialty>>
    with SessionEnvironmentMixin<List<HealthcareSpecialty>> {
  HealthcareSpecialtiesCatalogRepository({
    String? baseUrl,
    RepositoryHttpClient? client,
  }) : _client = client,
       super(
         endpoint: Uri.parse(
           '${baseUrl ?? AppConfig.apiBaseUrl}/api/v1/healthcare-specialties',
         ),
         name: 'HealthcareSpecialtiesCatalogRepository',
         resolveOnCreate: false,
       );

  final RepositoryHttpClient? _client;

  @override
  RepositoryHttpClient get client => _client ?? super.client;

  @override
  List<HealthcareSpecialty> fromJson(String json) {
    final decoded = jsonDecode(json);
    if (decoded is! Map<String, dynamic>) return const [];
    final data = decoded['data'];
    if (data is! List) return const [];
    return data
        .map(HealthcareSpecialty.tryFromMap)
        .whereType<HealthcareSpecialty>()
        .toList(growable: false);
  }

  Future<List<HealthcareSpecialty>> listActive() async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: endpoint,
        method: RepositoryHttpMethod.get,
      ),
    );
    if (!successfulCondition(response.statusCode, response.body)) {
      throw StateError(
        'Falha ao carregar especialidades (${response.statusCode})',
      );
    }
    return fromJson(response.body);
  }
}
