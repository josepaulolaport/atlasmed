import 'dart:async';
import 'dart:convert';

import 'package:dartz/dartz.dart';
import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/user/models/auth_error.dart';
import 'package:atlasmed_mobile_app/repository/base_repository.dart';
import 'package:atlasmed_mobile_app/repository/domain/exceptions/network_unavailable_exception.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';
import 'package:atlasmed_mobile_app/core/session/models/session.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';

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
        method: .put,
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
          ready: (ready) =>
              ready.data != null ? .authenticated : .unauthenticated,
          empty: (_) => .unauthenticated,
        ) ??
        .unauthenticated;
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
        method: .put,
        headers: {'Content-Type': 'application/json'},
        body: {'refreshToken': session.refreshToken},
      ),
    );

    if (successfulCondition(response.statusCode, response.body)) {
      return response.body;
    }

    // Refresh rejected → clear local credentials so the user can log in again
    // cleanly (do not treat 401 as success — that left a broken Hive session).
    if (response.statusCode == 401 ||
        response.statusCode == 400 ||
        response.statusCode == 403) {
      await delete();
      await emit(data: null, datasource: .remote);
      return null;
    }

    final shouldThrow = await onErrorStatusCode(response.statusCode);
    if (shouldThrow) {
      return null;
    }
    return response.body;
  }

  @override
  bool successfulCondition(int statusCode, dynamic body) {
    return statusCode == 200;
  }

  @override
  Future<bool> onErrorStatusCode(int statusCode) async {
    if (statusCode == 400 || statusCode == 401 || statusCode == 403) {
      await delete();
      await emit(data: null, datasource: .remote);
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
  /// Returns [Right] with the [Session] on success, or [Left] with a
  /// [CreateSessionError] on failure.
  Future<Either<CreateSessionError, Session>> login({
    required String email,
    required String password,
  }) async {
    try {
      final response = await client.call(
        request: RepositoryHttpRequest(
          url: Uri.parse('$_baseUrl/api/v1/session/'),
          method: .post,
          headers: {'Content-Type': 'application/json'},
          body: {'identifier': email, 'password': password},
        ),
      );

      if (response.statusCode == 200) {
        final session = fromJson(response.body);
        if (session == null) {
          throw StateError(
            'login: 200 OK but failed to parse session. Body: ${response.body}',
          );
        }

        await update((_) => session);
        return Right(session);
      }

      if (response.statusCode == 401) {
        return const Left(.wrongCredentials);
      }

      if (response.statusCode == 423) {
        return const Left(.accountLocked);
      }

      if (response.statusCode == 429) {
        return const Left(.tooManyAttempts);
      }

      throw StateError(
        'login: unexpected status ${response.statusCode}. Body: ${response.body}',
      );
    } on NetworkUnavailableException {
      return const Left(.networkError);
    }
  }

  /// Send password reset code to email/WhatsApp (`POST /access/password-reset/request`).
  ///
  /// Always succeeds on 200 — API does not reveal whether the identifier exists.
  Future<Either<PasswordResetError, void>> requestPasswordReset(
    String email,
  ) async {
    try {
      final response = await client.call(
        request: RepositoryHttpRequest(
          url: Uri.parse('$_baseUrl/api/v1/access/password-reset/request'),
          method: .post,
          body: {'identifier': email.trim()},
          headers: const {'Content-Type': 'application/json'},
        ),
      );

      if (response.statusCode == 200 || response.statusCode == 204) {
        return const Right(null);
      }

      throw StateError(
        'requestPasswordReset: unexpected status ${response.statusCode}. Body: ${response.body}',
      );
    } on NetworkUnavailableException {
      return const Left(.networkError);
    }
  }

  /// Verify the 6-digit reset code (`POST /access/password-reset/verify`).
  Future<Either<PasswordResetError, bool>> verifyResetCode(
    String email,
    String code,
  ) async {
    try {
      final response = await client.call(
        request: RepositoryHttpRequest(
          url: Uri.parse('$_baseUrl/api/v1/access/password-reset/verify'),
          method: .post,
          body: {'token': code.trim()},
          headers: const {'Content-Type': 'application/json'},
        ),
      );

      if (response.statusCode == 200) {
        return const Right(true);
      }

      if (response.statusCode == 401 ||
          response.statusCode == 400 ||
          response.statusCode == 422) {
        return const Right(false);
      }

      throw StateError(
        'verifyResetCode: unexpected status ${response.statusCode}. Body: ${response.body}',
      );
    } on NetworkUnavailableException {
      return const Left(.networkError);
    }
  }

  /// Reset password with the verified code (`POST /access/password-reset/confirm`).
  Future<Either<PasswordResetError, void>> resetPassword({
    required String email,
    required String code,
    required String newPassword,
  }) async {
    try {
      final response = await client.call(
        request: RepositoryHttpRequest(
          url: Uri.parse('$_baseUrl/api/v1/access/password-reset/confirm'),
          method: .post,
          body: {'token': code.trim(), 'newPassword': newPassword},
          headers: const {'Content-Type': 'application/json'},
        ),
      );

      if (response.statusCode == 200 || response.statusCode == 204) {
        return const Right(null);
      }

      if (response.statusCode == 401) {
        return const Left(.invalidCode);
      }
      if (response.statusCode == 422) {
        return const Left(.expiredCode);
      }

      throw StateError(
        'resetPassword: unexpected status ${response.statusCode}. Body: ${response.body}',
      );
    } on NetworkUnavailableException {
      return const Left(.networkError);
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
            method: .delete,
            headers: {'Authorization': 'Bearer $bearerToken'},
          ),
        );
      }
    } catch (e) {
      BaseRepository.logger(
        'Repository($name): Failed to revoke remote session: $e',
      );
      rethrow;
    } finally {
      await clear();
    }
  }
}
