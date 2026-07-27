import 'dart:async';

import 'package:atlasmed_mobile_app/repository/domain/exceptions/network_unavailable_exception.dart';
import 'package:atlasmed_mobile_app/repository/external/platform_http_client.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment.dart';

/// Thrown when a session expires and needs refresh.
class SessionExpiredException implements Exception {
  const SessionExpiredException();
}

/// Mixin that automatically integrates repositories with [SessionEnvironment].
///
/// Usage:
/// ```dart
/// class MyRepository extends Repository<MyData>
///     with SessionEnvironmentMixin<MyData> {
///   MyRepository() : super(endpoint: Uri.parse('...'));
/// }
/// ```
///
/// Automatically:
/// - Injects `Authorization: Bearer <token>` via [tokenBuilder]
/// - Handles 401/403 by refreshing or logging out
/// - Retries on [SessionExpiredException] and [NetworkUnavailableException]
/// - Skips refresh when no active session exists
mixin SessionEnvironmentMixin<T> on Repository<T> {
  bool get _isSessionEnvironment => this is SessionEnvironment;
  bool get _requiresAuthentication => !_isSessionEnvironment;

  bool get _hasActiveSession =>
      SessionEnvironment.instance.currentValue != null;

  @override
  late final RepositoryHttpClient client = createPlatformHttpClient(
    tokenBuilder: tokenBuilder,
  );

  /// Reads the bearer token from [SessionEnvironment].
  /// Triggers a session refresh if the current value is null.
  Future<String?> tokenBuilder() async {
    try {
      final session = await SessionEnvironment.instance.currentValueOrResolve();
      return session?.token;
    } catch (_) {
      return null;
    }
  }

  @override
  FutureOr<bool> shouldRetry(Exception exception) {
    if (exception is SessionExpiredException ||
        exception is NetworkUnavailableException) {
      return true;
    }
    return super.shouldRetry(exception);
  }

  @override
  Future<T?> refresh() {
    // Skip refresh if there's no active session
    if (_requiresAuthentication && !_hasActiveSession) {
      return Future.value(currentValue);
    }
    return super.refresh();
  }

  @override
  Future<bool> onErrorStatusCode(int statusCode) async {
    // Only auth failures trigger session refresh. A 5xx from the API is a
    // server/DB error — treating it as session expiry caused retry loops and
    // misleading SessionExpiredException logs (e.g. facilities 500).
    if (statusCode == 403) {
      // Authorization is not authentication: leave the active session intact
      // so feature forms can show their permission-specific error.
      return true;
    }
    if (statusCode == 401) {
      if (_isSessionEnvironment) {
        // SessionEnvironment itself got rejected → full logout
        await SessionEnvironment.instance.delete();
        return false;
      }

      // Another repo got rejected → try refreshing the session first.
      await SessionEnvironment.instance.refresh();

      if (SessionEnvironment.instance.currentValue == null) {
        // The refresh could not restore a valid session — it has been
        // revoked or expired server-side. Retrying with a dead token would
        // just loop forever, so clear local credentials and log the user
        // out instead.
        await SessionEnvironment.instance.delete();
        return true;
      }

      throw const SessionExpiredException();
    }
    return super.onErrorStatusCode(statusCode);
  }
}
