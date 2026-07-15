/// Exception thrown by authentication operations.
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
