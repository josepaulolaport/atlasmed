import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/core/user/models/user.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

/// Who is signed in.
///
/// **Depends on the session**, so it re-resolves whenever one is established.
/// This repository is a long-lived singleton and `currentValueOrResolve()`
/// returns its cached value without refetching, so without the dependency the
/// user is whoever happened to load first for the lifetime of the process:
/// signing out and back in as somebody else left the previous person's name,
/// e-mail and role in place, and clearing it on logout instead left the drawer
/// showing "Usuário" with the role-less navigation until the app restarted.
///
/// The dependency fires on `RepositoryStateReady` only, which is exactly the
/// right edge — a new session refreshes the user; logout emits empty and is
/// left alone, because logout clears this repository directly.
class UserRepository extends Repository<User>
    with SessionEnvironmentMixin<User> {
  UserRepository({String? baseUrl})
    : super(
        endpoint: Uri.parse('${baseUrl ?? AppConfig.apiBaseUrl}/api/v1/user'),
        name: 'UserRepository',
        dependencies: [SessionEnvironment.instance],
      );

  @override
  User fromJson(String json) {
    return User.fromJson(jsonDecode(json) as Map<String, dynamic>);
  }

  Future<void> replaceCachedUser(User user) => emit(data: user);
}
