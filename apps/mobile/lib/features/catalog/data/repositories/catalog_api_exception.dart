import 'dart:convert';

import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';

/// Thrown by [CatalogRepository] whenever the API responds with a non-2xx
/// status. Wraps the structured `{ error: { code, message } }` body every
/// AtlasMed API error follows (see
/// `features/territories/data/repositories/territory_api_exception.dart`
/// for the same pattern) so the UI can surface [message] directly — e.g.
/// "This competitor product is already linked to this product" instead of
/// a generic "something went wrong".
class CatalogApiException implements Exception {
  const CatalogApiException({
    required this.statusCode,
    required this.code,
    required this.message,
  });

  final int statusCode;
  final String code;
  final String message;

  /// Parses the error response body; falls back to a generic message if
  /// the body isn't the expected shape (e.g. a raw 5xx from a proxy).
  factory CatalogApiException.fromResponse(RepositoryHttpResponse response) {
    try {
      final decoded = jsonDecode(response.body) as Map<String, dynamic>;
      final error = decoded['error'] as Map<String, dynamic>?;
      final message = error?['message'] as String?;
      if (message != null && message.isNotEmpty) {
        return CatalogApiException(
          statusCode: response.statusCode,
          code: error?['code'] as String? ?? 'UNKNOWN_ERROR',
          message: message,
        );
      }
    } catch (_) {
      // Falls through to the generic message below.
    }
    return CatalogApiException(
      statusCode: response.statusCode,
      code: 'UNKNOWN_ERROR',
      message: 'Ocorreu um erro inesperado (${response.statusCode}).',
    );
  }

  @override
  String toString() => message;
}
