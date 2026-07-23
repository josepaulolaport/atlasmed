import 'dart:convert';

import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';

/// Thrown by admin users/invites HTTP repositories on non-2xx responses.
class UsersApiException implements Exception {
  const UsersApiException({
    required this.statusCode,
    required this.code,
    required this.message,
  });

  final int statusCode;
  final String code;
  final String message;

  factory UsersApiException.fromResponse(RepositoryHttpResponse response) {
    try {
      final decoded = jsonDecode(response.body) as Map<String, dynamic>;
      final error = decoded['error'];
      if (error is Map<String, dynamic>) {
        final message = error['message'] as String?;
        if (message != null && message.isNotEmpty) {
          return UsersApiException(
            statusCode: response.statusCode,
            code: error['code'] as String? ?? 'UNKNOWN_ERROR',
            message: message,
          );
        }
      }
      if (error is String && error.isNotEmpty) {
        return UsersApiException(
          statusCode: response.statusCode,
          code: decoded['code'] as String? ?? 'UNKNOWN_ERROR',
          message: error,
        );
      }
    } catch (_) {}
    return UsersApiException(
      statusCode: response.statusCode,
      code: 'UNKNOWN_ERROR',
      message: 'Ocorreu um erro inesperado (${response.statusCode}).',
    );
  }

  @override
  String toString() => message;
}
