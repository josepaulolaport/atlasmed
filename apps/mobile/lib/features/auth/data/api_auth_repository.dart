import '../../../../core/network/api_client.dart';
import '../../../../core/network/api_exception.dart';
import '../../../../core/storage/token_storage.dart';
import 'auth_repository.dart';
import 'models.dart';

class ApiAuthRepository implements AuthRepository {
  ApiAuthRepository({
    required ApiClient apiClient,
    required TokenStorage tokenStorage,
  })  : _api = apiClient,
        _tokenStorage = tokenStorage;

  final ApiClient _api;
  final TokenStorage _tokenStorage;

  @override
  Future<AuthSession> login(LoginRequest request) async {
    try {
      final data = await _api.post('/access/login', body: request.toJson(), auth: false);

      if (data['requires2FA'] == true) {
        throw const AuthException(
          kind: AuthErrorKind.requires2FA,
          message: 'Autenticação em dois fatores ainda não suportada no app.',
        );
      }

      final session = data['session'] as Map<String, dynamic>?;
      final user = data['user'] as Map<String, dynamic>?;
      if (session == null || user == null) {
        throw const AuthException(
          kind: AuthErrorKind.unknown,
          message: 'Resposta de login inválida.',
        );
      }

      final displayName = [
        user['firstName']?.toString(),
        user['lastName']?.toString(),
      ].where((p) => p != null && p.isNotEmpty).join(' ');

      final authSession = AuthSession(
        userId: user['id'].toString(),
        accessToken: session['token'].toString(),
        refreshToken: data['refreshToken']?.toString() ?? '',
        expiresAt: DateTime.now().add(const Duration(minutes: 15)),
        userDisplayName: displayName.isEmpty
            ? user['email']?.toString() ?? 'Usuário'
            : displayName,
      );

      await _tokenStorage.saveSession(
        userId: authSession.userId,
        accessToken: authSession.accessToken,
        refreshToken: authSession.refreshToken,
        expiresAt: authSession.expiresAt,
        userDisplayName: authSession.userDisplayName,
      );

      return authSession;
    } on ApiException catch (e) {
      throw _mapApiError(e);
    } catch (e) {
      if (e is AuthException) rethrow;
      throw AuthException(kind: AuthErrorKind.networkError, message: e.toString());
    }
  }

  @override
  Future<void> requestPasswordReset(ForgotPasswordRequest request) async {
    try {
      await _api.post(
        '/access/password-reset/request',
        body: request.toJson(),
        auth: false,
      );
    } on ApiException catch (e) {
      throw _mapApiError(e);
    } catch (e) {
      if (e is AuthException) rethrow;
      throw AuthException(
        kind: AuthErrorKind.networkError,
        message: 'Não foi possível conectar ao servidor.',
      );
    }
  }

  @override
  Future<void> validateResetToken(String token) async {
    try {
      await _api.post(
        '/access/password-reset/validate',
        body: {'token': token},
        auth: false,
      );
    } on ApiException catch (e) {
      throw _mapResetTokenError(e);
    } catch (e) {
      if (e is AuthException) rethrow;
      throw AuthException(
        kind: AuthErrorKind.networkError,
        message: 'Não foi possível conectar ao servidor.',
      );
    }
  }

  @override
  Future<void> resetPassword(ResetPasswordRequest request) async {
    try {
      await _api.post(
        '/access/password-reset/confirm',
        body: request.toJson(),
        auth: false,
      );
    } on ApiException catch (e) {
      throw _mapResetTokenError(e);
    } catch (e) {
      if (e is AuthException) rethrow;
      throw AuthException(
        kind: AuthErrorKind.networkError,
        message: 'Não foi possível conectar ao servidor.',
      );
    }
  }

  @override
  Future<AuthSession?> getStoredSession() async {
    final stored = await _tokenStorage.readSession();
    if (stored == null) return null;

    final session = AuthSession.fromJson(stored);
    if (session.isExpired) {
      final refreshToken = stored['refreshToken'];
      if (refreshToken == null || refreshToken.isEmpty) return null;
      try {
        final data = await _api.post(
          '/access/refresh',
          body: {'refreshToken': refreshToken},
          auth: false,
        );
        final newSession = data['session'] as Map<String, dynamic>?;
        final user = data['user'] as Map<String, dynamic>?;
        if (newSession == null || user == null) return null;

        final displayName = [
          user['firstName']?.toString(),
          user['lastName']?.toString(),
        ].where((p) => p != null && p.isNotEmpty).join(' ');

        final refreshed = AuthSession(
          userId: user['id'].toString(),
          accessToken: newSession['token'].toString(),
          refreshToken: data['refreshToken']?.toString() ?? refreshToken,
          expiresAt: DateTime.now().add(const Duration(minutes: 15)),
          userDisplayName: displayName.isEmpty
              ? user['email']?.toString() ?? session.userDisplayName
              : displayName,
        );

        await _tokenStorage.saveSession(
          userId: refreshed.userId,
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken,
          expiresAt: refreshed.expiresAt,
          userDisplayName: refreshed.userDisplayName,
        );

        return refreshed;
      } catch (_) {
        await _tokenStorage.clear();
        return null;
      }
    }

    return session;
  }

  @override
  Future<void> clearSession() async {
    try {
      await _api.post('/access/logout');
    } catch (_) {
      // Ignore logout network errors — still clear local session.
    }
    await _tokenStorage.clear();
  }

  AuthException _mapResetTokenError(ApiException e) {
    final code = e.code ?? '';

    if (e.statusCode == 410 || code.contains('RESET_TOKEN_EXPIRED')) {
      return const AuthException(
        kind: AuthErrorKind.expiredCode,
        message: 'Código expirado. Solicite um novo e-mail.',
      );
    }

    if (e.statusCode == 401 ||
        e.statusCode == 422 ||
        code.contains('RESET_TOKEN_INVALID') ||
        code.contains('RESET_TOKEN_USED')) {
      return const AuthException(
        kind: AuthErrorKind.invalidCode,
        message: 'Código inválido ou já utilizado.',
      );
    }

    return _mapApiError(e);
  }

  AuthException _mapApiError(ApiException e) {
    final code = e.code ?? '';
    final message = e.message.toLowerCase();

    if (e.statusCode == 401 || code.contains('INVALID_CREDENTIALS')) {
      return const AuthException(
        kind: AuthErrorKind.wrongCredentials,
        message: 'E-mail ou senha incorretos.',
      );
    }

    if (message.contains('locked') || message.contains('bloque')) {
      return const AuthException(
        kind: AuthErrorKind.accountLocked,
        message: 'Muitas tentativas. Recupere sua senha para continuar.',
      );
    }

    return AuthException(
      kind: AuthErrorKind.unknown,
      message: e.message,
    );
  }
}
