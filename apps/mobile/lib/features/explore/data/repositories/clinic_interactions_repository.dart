import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/features/explore/data/clinic_detail.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

class ClinicInteractionsException implements Exception {
  const ClinicInteractionsException();
}

class ClinicInteractionsRepository extends Repository<List<Interaction>>
    with SessionEnvironmentMixin<List<Interaction>> {
  ClinicInteractionsRepository(this.facilityId, {RepositoryHttpClient? client})
    : _client = client,
      super(
        endpoint: Uri.parse(
          '${AppConfig.apiBaseUrl}/api/v1/facilities/$facilityId/interactions',
        ),
        resolveOnCreate: false,
        name: 'ClinicInteractionsRepository',
      );

  final String facilityId;
  final RepositoryHttpClient? _client;

  @override
  RepositoryHttpClient get client => _client ?? super.client;

  @override
  List<Interaction> fromJson(String json) {
    final decoded = jsonDecode(json) as Map<String, dynamic>;
    final data = decoded['data'] as List<dynamic>;
    return data
        .map((item) => Interaction.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<Interaction> createInteraction({
    required InteractionType type,
    required String summary,
    String? interactedAt,
  }) async {
    final body = <String, dynamic>{'type': type.toJson(), 'summary': summary};
    if (interactedAt != null) {
      body['interactedAt'] = interactedAt;
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
        throw const ClinicInteractionsException();
      }
    }

    final created = Interaction.fromJson(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
    await refresh();
    return created;
  }
}
