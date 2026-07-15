import 'dart:async';
import 'dart:convert';

import 'package:dartz/dartz.dart';
import 'package:flutter/foundation.dart';

import '../config/app_config.dart';
import '../../features/auth/data/auth_repository.dart';
import '../../repository/base_repository.dart';
import '../../repository/domain/entities/data_source.dart';
import '../../repository/external/platform_http_client.dart';
import '../../repository/infra/repository_http_client.dart';
import '../../repository/repositories/http_repository.dart';
import '../../features/auth/data/models/session.dart';
import 'mixins/session_environment_mixin.dart';

/// Authentication state emitted by [SessionEnvironment].
enum AuthenticationState { unauthenticated, authenticated }

/// Central singleton for managing authentication sessions.
///
/// Extends [Repository<Session?>] with [SessionEnvironmentMixin] to provide:
/// - Persistent session storage via Hive (through the repository cache)
/// - Automatic token refresh every 8 minutes
/// - Bearer token injection via [SessionEnvironmentMixin.tokenBuilder]
/// - Reactive auth state stream
///
/// ## Architecture
///
/// ```
/// SessionEnvironment (singleton Repository<Session?>)
///   ├─ login(email, password)  → POST /api/v1/session/ → stores Session
///   ├─ refresh()              → PUT /api/v1/session/  → updates Session
///   ├─ delete()               → DELETE /api/v1/session/ → clears Session
///   └─ dataStream             → reactive auth state for the app
/// ```
///
/// All public methods return [Either] — Left on error, Right on success.
/// No exceptions are thrown (except internal infrastructure errors).
class SessionEnvironment extends Repository<Session?>
    with SessionEnvironmentMixin<Session?> {
  SessionEnvironment._({String? baseUrl, RepositoryHttpClient? client})
    : _baseUrl = baseUrl ?? _defaultBaseUrl,
      _client = client,
      super(
        endpoint: Uri.parse('${baseUrl ?? _defaultBaseUrl}/api/v1/session/'),
        autoRefreshInterval: const Duration(minutes: 8),
        name: 'SessionEnvironment',
        method: RepositoryHttpMethod.put,
      );

  static String get _defaultBaseUrl => AppConfig.apiBaseUrl;

  final String _baseUrl;
  final RepositoryHttpClient? _client;

  @override
  RepositoryHttpClient get client => _client ?? super.client;

  /// The singleton instance.
  static final SessionEnvironment instance = SessionEnvironment._();

  /// Exposes a simplified auth state stream for consumers.
  late final Stream<AuthenticationState> authState = stream.map((state) {
    return state.map(
      ready: (ready) => ready.data != null
          ? AuthenticationState.authenticated
          : AuthenticationState.unauthenticated,
      empty: (_) => AuthenticationState.unauthenticated,
    );
  });

  /// Returns a future that completes when the repository hydrates
  /// from local storage. Useful for checking if a session is cached
  /// before showing splash screens.
  Future<Session?> waitForHydration() => hydratationCompleter.future;

  @override
  Future<String?> resolve() async {
    final session = currentValue;
    if (session == null) {
      return null;
    }

    final response = await client.call(
      request: RepositoryHttpRequest(
        url: endpoint,
        method: RepositoryHttpMethod.put,
        body: {'refreshToken': session.refreshToken},
      ),
    );

    if (successfulCondition(response.statusCode, response.body)) {
      return response.body;
    }

    final shouldThrow = await onErrorStatusCode(response.statusCode);
    if (shouldThrow) {
      return null;
    }
    return response.body;
  }

  @override
  bool successfulCondition(int statusCode, dynamic body) {
    return statusCode == 200 || statusCode == 401;
  }

  @override
  Future<bool> onErrorStatusCode(int statusCode) async {
    if (statusCode == 400) {
      await delete();
      await emit(data: null, datasource: RepositoryDatasource.remote);
      return false;
    }
    return super.onErrorStatusCode(statusCode);
  }

  @override
  Session? fromJson(String json) {
    try {
      final data = jsonDecode(json) as Map<String, dynamic>;
      return Session.fromJson(data);
    } catch (_) {
      return null;
    }
  }

  /// Authenticate with email and password.
  ///
  /// Calls `POST /auth/login` with the credentials, stores the
  /// returned [Session], and makes it available to the stream.
  ///
  /// Returns `Right(session)` on success or `Left(AuthException)` on error.
  Future<Either<AuthException, Session?>> login({
    required String email,
    required String password,
  }) async {
    try {
      final response = await client.call(
        request: RepositoryHttpRequest(
          url: Uri.parse('$_baseUrl/api/v1/session/'),
          method: RepositoryHttpMethod.post,
          body: {'identifier': email, 'password': password},
        ),
      );

      if (response.statusCode == 200) {
        final session = fromJson(response.body);
        if (session != null) {
          await update((_) => session);
        }
        return Right(session);
      }

      if (response.statusCode == 401) {
        return Left(AuthException(
          kind: AuthErrorKind.wrongCredentials,
          message: 'E-mail ou senha incorretos.',
        ));
      }

      if (response.statusCode == 423) {
        return Left(AuthException(
          kind: AuthErrorKind.accountLocked,
          message: 'Conta temporariamente bloqueada. Tente novamente mais tarde.',
        ));
      }

      return Left(AuthException(
        kind: AuthErrorKind.unknown,
        message: 'Erro ao fazer login. Tente novamente.',
      ));
    } catch (e) {
      return Left(AuthException(
        kind: AuthErrorKind.networkError,
        message: 'Erro de rede. Verifique sua conexão.',
      ));
    }
  }

  /// Send password reset code to email.
  Future<Either<AuthException, void>> requestPasswordReset(String email) async {
    try {
      final response = await client.call(
        request: RepositoryHttpRequest(
          url: Uri.parse('$_baseUrl/auth/forgot-password'),
          method: RepositoryHttpMethod.post,
          body: {'email': email},
        ),
      );

      if (response.statusCode == 200 || response.statusCode == 204) {
        return const Right(null);
      }

      if (response.statusCode == 404) {
        return Left(AuthException(
          kind: AuthErrorKind.emailNotFound,
          message: 'E-mail não encontrado.',
        ));
      }

      return Left(AuthException(
        kind: AuthErrorKind.unknown,
        message: 'Erro ao solicitar redefinição de senha.',
      ));
    } catch (e) {
      return Left(AuthException(
        kind: AuthErrorKind.networkError,
        message: 'Erro de rede. Verifique sua conexão.',
      ));
    }
  }

  /// Verify the 6-digit reset code.
  Future<Either<AuthException, bool>> verifyResetCode(
    String email,
    String code,
  ) async {
    try {
      final response = await client.call(
        request: RepositoryHttpRequest(
          url: Uri.parse('$_baseUrl/auth/verify-reset-code'),
          method: RepositoryHttpMethod.post,
          body: {'email': email, 'code': code},
        ),
      );

      if (response.statusCode == 200) {
        return const Right(true);
      }

      if (response.statusCode == 400 || response.statusCode == 404) {
        return const Right(false);
      }

      return Left(AuthException(
        kind: AuthErrorKind.unknown,
        message: 'Erro ao verificar código.',
      ));
    } catch (e) {
      return Left(AuthException(
        kind: AuthErrorKind.networkError,
        message: 'Erro de rede. Verifique sua conexão.',
      ));
    }
  }

  /// Reset password with the verified code.
  Future<Either<AuthException, void>> resetPassword({
    required String email,
    required String code,
    required String newPassword,
  }) async {
    try {
      final response = await client.call(
        request: RepositoryHttpRequest(
          url: Uri.parse('$_baseUrl/auth/reset-password'),
          method: RepositoryHttpMethod.post,
          body: {
            'email': email,
            'code': code,
            'password': newPassword,
          },
        ),
      );

      if (response.statusCode == 200 || response.statusCode == 204) {
        return const Right(null);
      }

      return Left(AuthException(
        kind: AuthErrorKind.unknown,
        message: 'Erro ao redefinir senha.',
      ));
    } catch (e) {
      return Left(AuthException(
        kind: AuthErrorKind.networkError,
        message: 'Erro de rede. Verifique sua conexão.',
      ));
    }
  }

  /// Logout — revoke session server-side and clear local data.
  Future<void> delete() async {
    final session = currentValue;
    final bearerToken = session?.token.trim();

    try {
      if (bearerToken != null && bearerToken.isNotEmpty) {
        await client.call(
          request: RepositoryHttpRequest(
            url: Uri.parse('$_baseUrl/api/v1/session/'),
            method: RepositoryHttpMethod.delete,
            headers: {'Authorization': 'Bearer $bearerToken'},
          ),
        );
      }
    } catch (e) {
      BaseRepository.logger(
        'Repository($name): Failed to revoke remote session: $e',
      );
    } finally {
      await clear();
    }
  }
}


