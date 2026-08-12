import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/core/user/models/user.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

class UserRepository extends Repository<User>
    with SessionEnvironmentMixin<User> {
  UserRepository({String? baseUrl})
    : super(
        endpoint: Uri.parse('${baseUrl ?? AppConfig.apiBaseUrl}/api/v1/user'),
        name: 'UserRepository',
      );

  @override
  User fromJson(String json) {
    return User.fromJson(jsonDecode(json) as Map<String, dynamic>);
  }

  Future<void> replaceCachedUser(User user) => emit(data: user);
}
