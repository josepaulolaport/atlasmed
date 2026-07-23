import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/features/auth/data/person_name_match.dart';
import 'package:atlasmed_mobile_app/repository/external/platform_http_client.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';

class InviteValidation {
  const InviteValidation({
    required this.roleId,
    required this.roleName,
    required this.expiresAt,
    this.email,
    this.phoneNumber,
    this.firstName,
    this.lastName,
  });

  final String? email;
  final String? phoneNumber;
  final String? firstName;
  final String? lastName;
  final String roleId;
  final String roleName;
  final DateTime expiresAt;

  /// Invite was sent to a fixed email — register must use the same address.
  bool get emailLocked => email != null && email!.trim().isNotEmpty;

  /// Invite was sent to a fixed phone — register must use the same number.
  bool get phoneLocked => phoneNumber != null && phoneNumber!.trim().isNotEmpty;

  String get expectedFullName => [firstName, lastName]
      .whereType<String>()
      .map((s) => s.trim())
      .where((s) => s.isNotEmpty)
      .join(' ');

  factory InviteValidation.fromJson(Map<String, dynamic> json) {
    final role = json['role'] as Map<String, dynamic>;
    return InviteValidation(
      email: json['email'] as String?,
      phoneNumber: json['phoneNumber'] as String?,
      firstName: json['firstName'] as String?,
      lastName: json['lastName'] as String?,
      roleId: role['id'] as String,
      roleName: role['name'] as String,
      expiresAt: DateTime.parse(json['expiresAt'] as String),
    );
  }
}

class InviteRegistrationException implements Exception {
  InviteRegistrationException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}

/// Public (unauthenticated) invite accept / register API.
class InviteRegistrationRepository {
  InviteRegistrationRepository({String? baseUrl})
    : _baseUrl = baseUrl ?? AppConfig.apiBaseUrl;

  final String _baseUrl;
  final RepositoryHttpClient _client = createPlatformHttpClient();

  Uri _uri(String path) => Uri.parse('$_baseUrl/api/v1/access$path');

  Future<InviteValidation> validateToken(String token) async {
    final response = await _client.call(
      request: RepositoryHttpRequest(
        url: _uri('/invite/${Uri.encodeComponent(token.trim())}'),
      ),
    );
    if (response.statusCode != 200) {
      throw InviteRegistrationException(
        _errorMessage(response) ??
            'Token de cadastro inválido, expirado ou já utilizado',
        statusCode: response.statusCode,
      );
    }
    return InviteValidation.fromJson(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
  }

  Future<void> register({
    required String token,
    required String email,
    required String username,
    required String password,
    required String firstName,
    required String lastName,
    required DateTime birthDate,
    String? phoneNumber,
  }) async {
    final response = await _client.call(
      request: RepositoryHttpRequest(
        url: _uri('/register'),
        method: RepositoryHttpMethod.post,
        headers: const {'Content-Type': 'application/json'},
        body: {
          'token': token.trim(),
          'email': email.trim(),
          'username': username.trim(),
          'password': password,
          'firstName': firstName.trim(),
          'lastName': lastName.trim(),
          'birthDate': formatBirthDateIso(birthDate),
          if (phoneNumber != null && phoneNumber.trim().isNotEmpty)
            'phoneNumber': phoneNumber.trim(),
        },
      ),
    );
    if (response.statusCode != 200) {
      throw InviteRegistrationException(
        _errorMessage(response) ??
            'Não foi possível concluir o cadastro. Verifique os dados e o token.',
        statusCode: response.statusCode,
      );
    }
  }

  String? _errorMessage(RepositoryHttpResponse response) {
    try {
      final decoded = jsonDecode(response.body);
      if (decoded is Map<String, dynamic>) {
        final error = decoded['error'];
        if (error is String) return error;
        if (error is Map) {
          final errors = error['errors'];
          if (errors is List && errors.isNotEmpty) {
            final first = errors.first;
            if (first is Map && first['message'] is String) {
              return first['message'] as String;
            }
          }
          final message = error['message'];
          if (message is String &&
              message.isNotEmpty &&
              message != 'Request validation failed' &&
              message != 'Invalid request data') {
            return message;
          }
        }
        final message = decoded['message'];
        if (message is String && message.isNotEmpty) return message;
      }
    } catch (_) {}
    return null;
  }
}
