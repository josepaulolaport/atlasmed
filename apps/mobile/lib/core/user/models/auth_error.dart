/// Exception thrown by authentication operations.
class AuthException implements Exception {
  final CreateSessionError kind;
  final String message;
  final int? retryAfterSeconds;

  const AuthException({
    required this.kind,
    required this.message,
    this.retryAfterSeconds,
  });

  @override
  String toString() => 'AuthException($kind): $message';
}

enum CreateSessionError {
  wrongCredentials,
  accountLocked,
  tooManyAttempts,
  networkError,
  invalidCode,
  expiredCode,
  emailNotFound,
  unknown,
}
