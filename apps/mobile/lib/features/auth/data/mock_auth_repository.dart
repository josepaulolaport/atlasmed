import 'models.dart';
import 'auth_repository.dart';

/// Mock implementation of [AuthRepository] for development.
///
/// Replace provider with [ApiAuthRepository] when backend is ready —
/// no changes needed in screens or state management.
class MockAuthRepository implements AuthRepository {
  static const _demoEmail = 'rafael.melo@atlasmed.com';
  static const _demoPassword = 'Atlas2026';
  static const _demoCode = '123456';

  int _attempts = 0;
  static const _maxAttempts = 4;

  AuthSession? _storedSession;

  @override
  Future<AuthSession> login(LoginRequest request) async {
    // Simulate network delay
    await Future.delayed(const Duration(milliseconds: 900));

    _attempts++;

    if (_attempts >= _maxAttempts) {
      throw const AuthException(
        kind: AuthErrorKind.accountLocked,
        message: 'Muitas tentativas. Recupere sua senha para continuar.',
      );
    }

    if (request.email != _demoEmail || request.password != _demoPassword) {
      throw const AuthException(
        kind: AuthErrorKind.wrongCredentials,
        message: 'E-mail ou senha incorretos.',
      );
    }

    final session = AuthSession(
      userId: 'user-001',
      accessToken: 'mock_access_token_${DateTime.now().millisecondsSinceEpoch}',
      refreshToken: 'mock_refresh_token',
      expiresAt: DateTime.now().add(const Duration(days: 7)),
      userDisplayName: 'Rafael Melo',
    );

    _storedSession = session;
    _attempts = 0;
    return session;
  }

  @override
  Future<void> requestPasswordReset(ForgotPasswordRequest request) async {
    await Future.delayed(const Duration(milliseconds: 700));

    if (request.email != _demoEmail) {
      throw const AuthException(
        kind: AuthErrorKind.emailNotFound,
        message: 'E-mail não encontrado.',
      );
    }
    // In production, sends email with 6-digit code
  }

  @override
  Future<bool> verifyResetCode(String email, String code) async {
    await Future.delayed(const Duration(milliseconds: 700));
    return code == _demoCode;
  }

  @override
  Future<void> resetPassword(ResetPasswordRequest request) async {
    await Future.delayed(const Duration(milliseconds: 900));
    // In production, posts to backend
  }

  @override
  Future<AuthSession?> getStoredSession() async {
    return _storedSession;
  }

  @override
  Future<void> clearSession() async {
    _storedSession = null;
  }
}
