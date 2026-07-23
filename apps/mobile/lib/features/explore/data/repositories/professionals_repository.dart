import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api_types/doctor_api_type.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

class ProfessionalsException implements Exception {
  const ProfessionalsException([this.message]);

  final String? message;

  @override
  String toString() => message ?? 'ProfessionalsException';
}

class ProfessionalsRepository extends Repository<ApiDoctor>
    with SessionEnvironmentMixin<ApiDoctor> {
  ProfessionalsRepository(this.professionalId, {RepositoryHttpClient? client})
    : _client = client,
      super(
        endpoint: Uri.parse(
          '${AppConfig.apiBaseUrl}/api/v1/professionals/$professionalId',
        ),
        resolveOnCreate: false,
        name: 'ProfessionalsRepository',
      );

  final String professionalId;
  final RepositoryHttpClient? _client;

  @override
  RepositoryHttpClient get client => _client ?? super.client;

  @override
  ApiDoctor fromJson(String json) {
    final map = jsonDecode(json) as Map<String, dynamic>;
    return ApiDoctor.fromMap(map);
  }

  /// Direct PATCH of professional profile fields. Null clears nullable fields.
  Future<ApiDoctor> updateProfessional(Map<String, dynamic> patch) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: endpoint,
        method: RepositoryHttpMethod.patch,
        headers: const {'Content-Type': 'application/json'},
        body: patch,
      ),
    );

    if (!successfulCondition(response.statusCode, response.body)) {
      final shouldThrow = await onErrorStatusCode(response.statusCode);
      if (shouldThrow) {
        throw ProfessionalsException(
          'Falha ao atualizar profissional (${response.statusCode})',
        );
      }
    }

    final updated = fromJson(response.body);
    await refresh();
    return updated;
  }
}
