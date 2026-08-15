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
        endpoint: Uri.parse('${baseUrl ?? AppConfig.apiBaseUrl}/api/v1/roteiros'),
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
  Future<Roteiro> generate({
    required int verticalId,
    required double latitude,
    required double longitude,
    int? limit,
    int? anchorProfileId,
    int? subjectUserId,
  }) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse('$_baseUrl/api/v1/roteiros/preview'),
        method: RepositoryHttpMethod.post,
        body: {
          'verticalId': verticalId,
          'origin': {'lat': latitude, 'lng': longitude},
          'limit': ?limit,
          'anchorProfileId': ?anchorProfileId,
          'subjectUserId': ?subjectUserId,
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
}
