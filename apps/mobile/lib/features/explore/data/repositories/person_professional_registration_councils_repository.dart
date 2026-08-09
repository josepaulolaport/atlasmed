import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/professional_registration.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

/// Active councils — `GET /api/v1/person-professional-registration-councils`.
class PersonProfessionalRegistrationCouncilsRepository
    extends Repository<List<ProfessionalRegistrationCouncil>>
    with SessionEnvironmentMixin<List<ProfessionalRegistrationCouncil>> {
  PersonProfessionalRegistrationCouncilsRepository({
    String? baseUrl,
    RepositoryHttpClient? client,
  }) : _client = client,
       super(
         endpoint: Uri.parse(
           '${baseUrl ?? AppConfig.apiBaseUrl}'
           '/api/v1/person-professional-registration-councils',
         ),
         name: 'PersonProfessionalRegistrationCouncilsRepository',
         resolveOnCreate: false,
       );

  final RepositoryHttpClient? _client;

  @override
  RepositoryHttpClient get client => _client ?? super.client;

  @override
  List<ProfessionalRegistrationCouncil> fromJson(String json) {
    final decoded = jsonDecode(json);
    if (decoded is! Map<String, dynamic>) return const [];
    final data = decoded['data'];
    if (data is! List) return const [];
    return data
        .whereType<Map>()
        .map(
          (e) => ProfessionalRegistrationCouncil.fromMap(
            e.cast<String, dynamic>(),
          ),
        )
        .where((e) => e.id != 0 && e.abbreviation.isNotEmpty)
        .toList(growable: false);
  }

  Future<List<ProfessionalRegistrationCouncil>> listActive() async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: endpoint,
        method: RepositoryHttpMethod.get,
      ),
    );
    if (!successfulCondition(response.statusCode, response.body)) {
      throw StateError('Falha ao carregar conselhos (${response.statusCode})');
    }
    return fromJson(response.body);
  }
}
