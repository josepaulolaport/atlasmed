import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api_types/query_builder.dart';
import 'package:atlasmed_mobile_app/features/nao_conformidades/data/field_suggestion_mapper.dart';
import 'package:atlasmed_mobile_app/features/nao_conformidades/data/nao_conformidade_models.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

class FieldSuggestionsException implements Exception {
  const FieldSuggestionsException([this.message]);

  final String? message;

  @override
  String toString() => message ?? 'FieldSuggestionsException';
}

/// User-submitted Não Conformidades (`/field-suggestions` + facility nested).
class FieldSuggestionsRepository extends Repository<List<NaoConformidadeSuggestion>>
    with SessionEnvironmentMixin<List<NaoConformidadeSuggestion>> {
  FieldSuggestionsRepository({RepositoryHttpClient? client})
    : _client = client,
      super(
        endpoint: Uri.parse('${AppConfig.apiBaseUrl}/api/v1/field-suggestions'),
        resolveOnCreate: false,
        name: 'FieldSuggestionsRepository',
      );

  final RepositoryHttpClient? _client;

  @override
  RepositoryHttpClient get client => _client ?? super.client;

  @override
  List<NaoConformidadeSuggestion> fromJson(String json) {
    final decoded = jsonDecode(json);
    if (decoded is Map<String, dynamic>) {
      final data = decoded['data'];
      if (data is List) {
        return data
            .map((item) => suggestionFromApi(item as Map<String, dynamic>))
            .toList(growable: false);
      }
    }
    if (decoded is List) {
      return decoded
          .map((item) => suggestionFromApi(item as Map<String, dynamic>))
          .toList(growable: false);
    }
    return const [];
  }

  Future<List<NaoConformidadeSuggestion>> listOps({
    String status = 'PENDING',
    int page = 1,
    int limit = 100,
  }) async {
    final url = buildEndpoint(
      baseUrl: AppConfig.apiBaseUrl,
      path: '/api/v1/field-suggestions',
      queryParameters: {
        'status': status,
        'page': '$page',
        'limit': '$limit',
      },
    );
    return _getList(url);
  }

  Future<List<NaoConformidadeSuggestion>> listMineForFacility({
    required String facilityId,
    int page = 1,
    int limit = 100,
  }) async {
    final url = buildEndpoint(
      baseUrl: AppConfig.apiBaseUrl,
      path: '/api/v1/facilities/$facilityId/field-suggestions',
      queryParameters: {
        'mine': 'true',
        'page': '$page',
        'limit': '$limit',
      },
    );
    return _getList(url);
  }

  Future<NaoConformidadeSuggestion> getById(String id) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse('${AppConfig.apiBaseUrl}/api/v1/field-suggestions/$id'),
        method: RepositoryHttpMethod.get,
      ),
    );
    await _ensureOk(response, 'carregar sugestão');
    return suggestionFromApi(jsonDecode(response.body) as Map<String, dynamic>);
  }

  Future<NaoConformidadeSuggestion> createFieldChange({
    required String facilityId,
    required String fieldKey,
    required Object proposedValue,
    String? reason,
  }) async {
    return _create(
      facilityId: facilityId,
      body: {
        'kind': 'FIELD_CHANGE',
        'fieldKey': fieldKey,
        'proposedValue': proposedValue,
        if (reason != null && reason.trim().isNotEmpty) 'reason': reason.trim(),
      },
    );
  }

  Future<NaoConformidadeSuggestion> createDeactivation({
    required String facilityId,
    required String reason,
  }) async {
    return _create(
      facilityId: facilityId,
      body: {
        'kind': 'DEACTIVATION',
        'reason': reason.trim(),
      },
    );
  }

  Future<NaoConformidadeSuggestion> approve(
    String id, {
    String? resolutionNote,
  }) async {
    return _resolve(id, approve: true, resolutionNote: resolutionNote);
  }

  Future<NaoConformidadeSuggestion> reject(
    String id, {
    required String resolutionNote,
  }) async {
    return _resolve(id, approve: false, resolutionNote: resolutionNote);
  }

  Future<NaoConformidadeSuggestion> _create({
    required String facilityId,
    required Map<String, dynamic> body,
  }) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse(
          '${AppConfig.apiBaseUrl}/api/v1/facilities/$facilityId/field-suggestions',
        ),
        method: RepositoryHttpMethod.post,
        headers: const {'Content-Type': 'application/json'},
        body: body,
      ),
    );
    await _ensureOk(response, 'enviar sugestão');
    return suggestionFromApi(jsonDecode(response.body) as Map<String, dynamic>);
  }

  Future<NaoConformidadeSuggestion> _resolve(
    String id, {
    required bool approve,
    String? resolutionNote,
  }) async {
    final action = approve ? 'approve' : 'reject';
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse(
          '${AppConfig.apiBaseUrl}/api/v1/field-suggestions/$id/$action',
        ),
        method: RepositoryHttpMethod.post,
        headers: const {'Content-Type': 'application/json'},
        body: {
          if (resolutionNote != null && resolutionNote.trim().isNotEmpty)
            'resolutionNote': resolutionNote.trim(),
        },
      ),
    );
    await _ensureOk(
      response,
      approve ? 'aceitar sugestão' : 'rejeitar sugestão',
    );
    return suggestionFromApi(jsonDecode(response.body) as Map<String, dynamic>);
  }

  Future<List<NaoConformidadeSuggestion>> _getList(Uri url) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: url,
        method: RepositoryHttpMethod.get,
      ),
    );
    await _ensureOk(response, 'listar sugestões');
    return fromJson(response.body);
  }

  Future<void> _ensureOk(
    RepositoryHttpResponse response,
    String action,
  ) async {
    if (successfulCondition(response.statusCode, response.body)) return;
    final shouldThrow = await onErrorStatusCode(response.statusCode);
    if (shouldThrow) {
      throw FieldSuggestionsException(
        'Falha ao $action (${response.statusCode})',
      );
    }
    throw FieldSuggestionsException(
      'Falha ao $action (${response.statusCode})',
    );
  }
}
