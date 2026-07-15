/// Errors returned by create session (login).
enum CreateSessionError {
  wrongCredentials,
  accountLocked,
  tooManyAttempts,
  networkError,
}

/// Errors returned by password reset flows.
enum PasswordResetError {
  emailNotFound,
  invalidCode,
  expiredCode,
  networkError,
}
