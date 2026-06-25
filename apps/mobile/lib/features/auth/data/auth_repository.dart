import 'models.dart';

/// Abstract repository for authentication.
///
/// Following the Open/Closed principle — the interface is stable.
/// Current implementation: [MockAuthRepository]
/// Future implementation: [ApiAuthRepository] (HTTP calls)
///
/// To swap, change the provider in auth_provider.dart.
abstract class AuthRepository {
  /// Authenticate with email and password.
  /// Throws [AuthException] on failure.
  Future<AuthSession> login(LoginRequest request);

  /// Send password reset code to email.
  Future<void> requestPasswordReset(ForgotPasswordRequest request);

  /// Verify the 6-digit reset code.
  Future<bool> verifyResetCode(String email, String code);

  /// Reset password with the verified code.
  Future<void> resetPassword(ResetPasswordRequest request);

  /// Check if a stored session is still valid.
  Future<AuthSession?> getStoredSession();

  /// Clear stored session (logout).
  Future<void> clearSession();
}

/// Exception thrown by [AuthRepository] methods.
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
  unknown,
}
