import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/core/user/models/user.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
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
  UserRepository({String? baseUrl, RepositoryHttpClient? client})
    : _client = client,
      super(
        endpoint: Uri.parse('${baseUrl ?? AppConfig.apiBaseUrl}/api/v1/user'),
        name: 'UserRepository',
        dependencies: [SessionEnvironment.instance],
      );

  /// Overrides the session client, so a caller under test can supply one.
  final RepositoryHttpClient? _client;

  @override
  RepositoryHttpClient get client => _client ?? super.client;

  @override
  User fromJson(String json) {
    return User.fromJson(jsonDecode(json) as Map<String, dynamic>);
  }

  Future<void> replaceCachedUser(User user) => emit(data: user);

  /// Renames the signed-in user.
  ///
  /// `PATCH /user` has always taken `firstName`/`lastName` — the only fields
  /// somebody may change about themselves — and nothing in the app called it. A
  /// rep whose name was typed wrong when they were invited had to ask an admin
  /// to fix a spelling.
  ///
  /// E-mail, telephone and username are deliberately not here: the endpoint
  /// does not accept them, because they identify the account rather than
  /// describe the person.
  Future<User?> updateName({
    required String firstName,
    required String lastName,
  }) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: endpoint,
        method: RepositoryHttpMethod.patch,
        headers: const {'Content-Type': 'application/json'},
        body: {'firstName': firstName, 'lastName': lastName},
      ),
    );

    if (successfulCondition(response.statusCode, response.body)) {
      final user = fromJson(response.body);
      await emit(data: user);
      return user;
    }

    final shouldThrow = await onErrorStatusCode(response.statusCode);
    if (shouldThrow) throw const UserUpdateException();
    return null;
  }
}

class UserUpdateException implements Exception {
  const UserUpdateException([
    this.message = 'Não foi possível salvar seu nome.',
  ]);

  final String message;

  @override
  String toString() => message;
}
