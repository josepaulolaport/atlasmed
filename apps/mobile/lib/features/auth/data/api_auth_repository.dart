import '../../../core/repositories/session_environment.dart';
import 'auth_repository.dart';
import 'models.dart';

/// Real implementation of [AuthRepository] that uses [SessionEnvironment].
///
/// Swaps with [MockAuthRepository] when backend is ready —
/// no changes needed in screens or state management.
class ApiAuthRepository implements AuthRepository {
  final SessionEnvironment _session;

  ApiAuthRepository({SessionEnvironment? session})
    : _session = session ?? SessionEnvironment.instance;

  @override
  Future<AuthSession> login(LoginRequest request) async {
    final session = await _session.login(
      email: request.email,
      password: request.password,
    );

    if (session == null) {
      throw const AuthException(
        kind: AuthErrorKind.unknown,
        message: 'Erro ao fazer login. Tente novamente.',
      );
    }

    // Map Session → AuthSession (the existing UI model)
    return AuthSession(
      userId: '', // Will be filled from /auth/whoami
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt,
      userDisplayName: '', // Will be filled from /auth/whoami
    );
  }

  @override
  Future<void> requestPasswordReset(ForgotPasswordRequest request) async {
    await _session.requestPasswordReset(request.email);
  }

  @override
  Future<bool> verifyResetCode(String email, String code) async {
    return _session.verifyResetCode(email, code);
  }

  @override
  Future<void> resetPassword(ResetPasswordRequest request) async {
    await _session.resetPassword(
      email: request.email,
      code: request.code,
      newPassword: request.newPassword,
    );
  }

  @override
  Future<AuthSession?> getStoredSession() async {
    // SessionEnvironment auto-hydrates from Hive on creation.
    // We wait for hydration, then check if there's an active session.
    final session = await _session.waitForHydration();
    if (session == null || session.isExpired) {
      return null;
    }
    return AuthSession(
      userId: '',
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt,
      userDisplayName: '',
    );
  }

  @override
  Future<void> clearSession() async {
    await _session.delete();
  }
}
