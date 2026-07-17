import 'dart:convert';

import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';

/// Thrown by [HttpTerritoryRepository]/[HttpUserRepository] whenever the
/// API responds with a non-2xx status. Wraps the structured
/// `{ error: { code, message } }` body every AtlasMed API error follows
/// (see `apps/api/src/shared/errors/base-error.ts`) so the UI can surface
/// [message] directly instead of a generic "something went wrong" — e.g.
/// "Manager zone still has active rep patches" on a blocked delete, or
/// "Rep patch must be fully contained inside exactly one active manager
/// zone" on a boundary save.
class TerritoryApiException implements Exception {
  final int statusCode;
  final String code;
  final String message;

  const TerritoryApiException({
    required this.statusCode,
    required this.code,
    required this.message,
  });

  /// Parses the error response body; falls back to a generic message if
  /// the body isn't the expected shape (e.g. a raw 5xx from a proxy).
  factory TerritoryApiException.fromResponse(RepositoryHttpResponse response) {
    try {
      final decoded = jsonDecode(response.body) as Map<String, dynamic>;
      final error = decoded['error'] as Map<String, dynamic>?;
      final message = error?['message'] as String?;
      if (message != null && message.isNotEmpty) {
        return TerritoryApiException(
          statusCode: response.statusCode,
          code: error?['code'] as String? ?? 'UNKNOWN_ERROR',
          message: message,
        );
      }
    } catch (_) {
      // Falls through to the generic message below.
    }
    return TerritoryApiException(
      statusCode: response.statusCode,
      code: 'UNKNOWN_ERROR',
      message: 'Ocorreu um erro inesperado (${response.statusCode}).',
    );
  }

  @override
  String toString() => message;
}
