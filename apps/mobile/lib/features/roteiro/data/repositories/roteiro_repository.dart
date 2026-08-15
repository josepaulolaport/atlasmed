import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/features/roteiro/data/roteiro.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

class RoteiroRepository extends Repository<String>
    with SessionEnvironmentMixin<String> {
  RoteiroRepository({String? baseUrl, RepositoryHttpClient? client})
    : _baseUrl = baseUrl ?? AppConfig.apiBaseUrl,
      _client = client,
      super(
        endpoint: Uri.parse(
          '${baseUrl ?? AppConfig.apiBaseUrl}/api/v1/roteiros',
        ),
        name: 'RoteiroRepository',
        resolveOnCreate: false,
      );

  final String _baseUrl;
  final RepositoryHttpClient? _client;

  @override
  RepositoryHttpClient get client => _client ?? super.client;

  /// Generates a slate from the rep's live position.
  ///
  /// `latitude`/`longitude` are required and have no fallback: the server
  /// refuses a guessed origin (spec 0016 §4.1), because drive times computed
  /// from an averaged position look exactly as confident as real ones.
  /// Generates without persisting — the workspace's draft.
  ///
  /// `/preview` rather than `/roteiros`: a rep regenerating while they shape the
  /// day should not be writing a row each time, and nothing is real until they
  /// save. Persisting on every keystroke would also make `last_suggested_at`
  /// meaningless, since a discarded draft would mark clinics as covered.
  Future<Roteiro> generate({
    required int verticalId,
    String? scopeDate,
    double? latitude,
    double? longitude,
    int? limit,
    int? subjectUserId,
    List<int> excludeProfileIds = const [],
    List<int> includeProfileIds = const [],
  }) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse('$_baseUrl/api/v1/roteiros/preview'),
        method: RepositoryHttpMethod.post,
        body: {
          'verticalId': verticalId,
          'scopeDate': ?scopeDate,
          if (latitude != null && longitude != null)
            'origin': {'lat': latitude, 'lng': longitude},
          'limit': ?limit,
          'subjectUserId': ?subjectUserId,
          if (excludeProfileIds.isNotEmpty)
            'excludeProfileIds': excludeProfileIds,
          if (includeProfileIds.isNotEmpty)
            'includeProfileIds': includeProfileIds,
        },
      ),
    );
    if (!successfulCondition(response.statusCode, response.body)) {
      final shouldThrow = await onErrorStatusCode(response.statusCode);
      if (shouldThrow) {
        throw StateError('Não foi possível gerar o roteiro.');
      }
    }
    return Roteiro.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
  }

  /// Persists the shaped slate, then writes it into the agenda.
  ///
  /// Two calls rather than one because persisting and confirming are separate
  /// concerns server-side — and because a 409 on confirm has to be
  /// distinguishable from a failure to save at all.
  Future<Roteiro> save({
    required int verticalId,
    String? scopeDate,
    double? latitude,
    double? longitude,
    int? limit,
    List<int> excludeProfileIds = const [],
    List<int> includeProfileIds = const [],
  }) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse('$_baseUrl/api/v1/roteiros'),
        method: RepositoryHttpMethod.post,
        body: {
          'verticalId': verticalId,
          'scopeDate': ?scopeDate,
          if (latitude != null && longitude != null)
            'origin': {'lat': latitude, 'lng': longitude},
          'limit': ?limit,
          if (excludeProfileIds.isNotEmpty)
            'excludeProfileIds': excludeProfileIds,
          if (includeProfileIds.isNotEmpty)
            'includeProfileIds': includeProfileIds,
        },
      ),
    );
    if (!successfulCondition(response.statusCode, response.body)) {
      final shouldThrow = await onErrorStatusCode(response.statusCode);
      if (shouldThrow) throw StateError('Não foi possível salvar o roteiro.');
    }
    final draft = Roteiro.fromJson(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
    final id = draft.id;
    if (id == null) throw StateError('Não foi possível salvar o roteiro.');
    return confirm(id);
  }

  /// Writes the roteiro into the agent's agenda.
  ///
  /// Idempotent server-side, so a retry after a dropped connection cannot
  /// double-book the day. A 409 means the calendar changed since the plan was
  /// generated — the times are never silently shifted, so the rep regenerates.
  Future<Roteiro> confirm(int roteiroId) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse('$_baseUrl/api/v1/roteiros/$roteiroId/confirm'),
        method: RepositoryHttpMethod.post,
        body: const {},
      ),
    );
    if (response.statusCode == 409) {
      throw const RoteiroConflictException();
    }
    if (!successfulCondition(response.statusCode, response.body)) {
      final shouldThrow = await onErrorStatusCode(response.statusCode);
      if (shouldThrow) {
        throw StateError('Não foi possível confirmar o roteiro.');
      }
    }
    return Roteiro.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
  }
}

/// The agenda changed since the roteiro was generated.
class RoteiroConflictException implements Exception {
  const RoteiroConflictException();

  @override
  String toString() =>
      'Sua agenda mudou desde que o roteiro foi gerado. Gere novamente para ver os horários atuais.';
}
