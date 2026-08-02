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
        final code = error['code'] as String? ?? 'UNKNOWN_ERROR';
        final fieldMessage = _firstFieldError(error);
        final message = fieldMessage ??
            (error['message'] as String?) ??
            (error['details'] as String?);
        if (message != null && message.isNotEmpty) {
          return UsersApiException(
            statusCode: response.statusCode,
            code: code,
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
      // Some handlers return { code, message, errors } at the top level.
      final fieldMessage = _firstFieldError(decoded);
      final topMessage = fieldMessage ?? decoded['message'] as String?;
      if (topMessage != null && topMessage.isNotEmpty) {
        return UsersApiException(
          statusCode: response.statusCode,
          code: decoded['code'] as String? ?? 'UNKNOWN_ERROR',
          message: topMessage,
        );
      }
    } catch (_) {}
    return UsersApiException(
      statusCode: response.statusCode,
      code: 'UNKNOWN_ERROR',
      message: 'Ocorreu um erro inesperado (${response.statusCode}).',
    );
  }

  static String? _firstFieldError(Map<String, dynamic> payload) {
    final errors = payload['errors'];
    if (errors is! List || errors.isEmpty) return null;
    final first = errors.first;
    if (first is Map<String, dynamic>) {
      final message = first['message'] as String?;
      if (message != null && message.isNotEmpty) return message;
    }
    return null;
  }

  @override
  String toString() => message;
}
