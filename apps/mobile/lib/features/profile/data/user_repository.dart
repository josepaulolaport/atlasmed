import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/repositories/mixins/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/features/auth/data/models/user.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

class UserRepository extends Repository<User>
    with SessionEnvironmentMixin<User> {
  UserRepository({String? baseUrl})
    : _baseUrl = baseUrl ?? AppConfig.apiBaseUrl,
      super(
        endpoint: Uri.parse('${baseUrl ?? AppConfig.apiBaseUrl}/api/v1/user'),
        name: 'UserRepository',
      );

  final String _baseUrl;

  @override
  User fromJson(String json) {
    return User.fromJson(jsonDecode(json) as Map<String, dynamic>);
  }

  Future<User?> updateProfile({
    String? firstName,
    String? lastName,
    String? avatarUrl,
  }) async {
    final body = <String, dynamic>{};
    if (firstName != null) body['firstName'] = firstName;
    if (lastName != null) body['lastName'] = lastName;
    if (avatarUrl != null) body['avatarUrl'] = avatarUrl;

    final response = await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse('$_baseUrl/api/v1/user'),
        method: RepositoryHttpMethod.patch,
        headers: {'Content-Type': 'application/json'},
        body: body,
      ),
    );

    if (successfulCondition(response.statusCode, response.body)) {
      final user = fromJson(response.body);
      await emit(data: user);
      return user;
    }

    final shouldThrow = await onErrorStatusCode(response.statusCode);
    if (shouldThrow) {
      return null;
    }
    return fromJson(response.body);
  }
}
