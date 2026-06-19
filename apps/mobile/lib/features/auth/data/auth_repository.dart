import 'models.dart';

/// Abstract repository for authentication.
abstract class AuthRepository {
  Future<AuthSession> login(LoginRequest request);
  Future<void> requestPasswordReset(ForgotPasswordRequest request);
  Future<void> validateResetToken(String token);
  Future<void> resetPassword(ResetPasswordRequest request);
  Future<AuthSession?> getStoredSession();
  Future<void> clearSession();
}

class AuthException implements Exception {
  final AuthErrorKind kind;
  final String message;

  const AuthException({required this.kind, required this.message});

  @override
  String toString() => 'AuthException($kind): $message';
}

enum AuthErrorKind {
  wrongCredentials,
  accountLocked,
  networkError,
  invalidCode,
  expiredCode,
  emailNotFound,
  requires2FA,
  unknown,
}
