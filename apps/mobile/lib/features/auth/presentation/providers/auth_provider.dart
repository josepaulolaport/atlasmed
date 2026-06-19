import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/auth_repository.dart';
import '../../data/models.dart';
import '../../data/mock_auth_repository.dart';

// ── Repository provider ─────────────────────────────────────
// Swap MockAuthRepository for ApiAuthRepository when backend is ready.
final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return MockAuthRepository();
});

// ── Auth state ──────────────────────────────────────────────
enum AuthStatus {
  unknown, // splash screen, checking stored session
  unauthenticated,
  authenticating,
  authenticated,
}

class AuthState {
  final AuthStatus status;
  final AuthSession? session;
  final AuthException? error;
  final int forgotStep; // 0=none, 1=email, 2=code, 3=new-password, 4=success
  final String forgotEmail;
  final String verificationCode;
  final String newPassword;
  final String confirmPassword;

  const AuthState({
    this.status = AuthStatus.unknown,
    this.session,
    this.error,
    this.forgotStep = 0,
    this.forgotEmail = '',
    this.verificationCode = '',
    this.newPassword = '',
    this.confirmPassword = '',
  });

  AuthState copyWith({
    AuthStatus? status,
    AuthSession? session,
    AuthException? error,
    int? forgotStep,
    String? forgotEmail,
    String? verificationCode,
    String? newPassword,
    String? confirmPassword,
    bool clearError = false,
  }) {
    return AuthState(
      status: status ?? this.status,
      session: session ?? this.session,
      error: clearError ? null : (error ?? this.error),
      forgotStep: forgotStep ?? this.forgotStep,
      forgotEmail: forgotEmail ?? this.forgotEmail,
      verificationCode: verificationCode ?? this.verificationCode,
      newPassword: newPassword ?? this.newPassword,
      confirmPassword: confirmPassword ?? this.confirmPassword,
    );
  }
}

// ── Auth Notifier ───────────────────────────────────────────
class AuthNotifier extends StateNotifier<AuthState> {
  final AuthRepository _repository;

  AuthNotifier(this._repository) : super(const AuthState());

  /// Check stored session on app start.
  Future<void> checkSession() async {
    try {
      final session = await _repository.getStoredSession();
      if (session != null && !session.isExpired) {
        state = state.copyWith(
          status: AuthStatus.authenticated,
          session: session,
        );
      } else {
        state = state.copyWith(status: AuthStatus.unauthenticated);
      }
    } catch (_) {
      state = state.copyWith(status: AuthStatus.unauthenticated);
    }
  }

  /// Attempt login with email + password.
  Future<void> login(String email, String password) async {
    state = state.copyWith(
      status: AuthStatus.authenticating,
      error: null,
      clearError: true,
    );

    try {
      final session = await _repository.login(
        LoginRequest(email: email, password: password),
      );
      state = state.copyWith(
        status: AuthStatus.authenticated,
        session: session,
        error: null,
      );
    } on AuthException catch (e) {
      state = state.copyWith(
        status: AuthStatus.unauthenticated,
        error: e,
      );
    }
  }

  /// Start forgot password flow — step 1: submit email.
  Future<void> submitForgotEmail(String email) async {
    state = state.copyWith(forgotEmail: email, error: null, clearError: true);

    try {
      await _repository.requestPasswordReset(
        ForgotPasswordRequest(email: email),
      );
      state = state.copyWith(forgotStep: 1, error: null);
    } on AuthException catch (e) {
      state = state.copyWith(error: e);
    }
  }

  /// Step 2: verify code.
  Future<bool> submitCode(String code) async {
    final ok = await _repository.verifyResetCode(state.forgotEmail, code);
    if (ok) {
      state = state.copyWith(forgotStep: 2, verificationCode: code, error: null);
      return true;
    } else {
      state = state.copyWith(
        error: const AuthException(
          kind: AuthErrorKind.invalidCode,
          message: 'Código inválido. Confira e tente novamente.',
        ),
      );
      return false;
    }
  }

  /// Step 3: submit new password.
  Future<void> submitNewPassword(String newPassword, String confirmPassword) async {
    state = state.copyWith(newPassword: newPassword, confirmPassword: confirmPassword);

    try {
      await _repository.resetPassword(
        ResetPasswordRequest(
          email: state.forgotEmail,
          code: state.verificationCode,
          newPassword: newPassword,
        ),
      );
      state = state.copyWith(forgotStep: 3, error: null);
    } on AuthException catch (e) {
      state = state.copyWith(error: e);
    }
  }

  /// Go back to forgot step.
  void forgotBack() {
    if (state.forgotStep == 1) {
      state = state.copyWith(forgotStep: 0, error: null, clearError: true);
    } else if (state.forgotStep == 2) {
      state = state.copyWith(forgotStep: 1);
    } else if (state.forgotStep == 3) {
      state = state.copyWith(forgotStep: 2);
    } else {
      state = state.copyWith(forgotStep: 0);
    }
  }

  /// Return to login from forgot success.
  void backToLogin() {
    state = state.copyWith(
      forgotStep: 0,
      forgotEmail: '',
      verificationCode: '',
      newPassword: '',
      confirmPassword: '',
      error: null,
    );
  }

  /// Logout.
  Future<void> logout() async {
    await _repository.clearSession();
    state = const AuthState(status: AuthStatus.unauthenticated);
  }

  /// Clear current error.
  void clearError() {
    state = state.copyWith(clearError: true);
  }
}

// ── Provider ────────────────────────────────────────────────
final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final repo = ref.watch(authRepositoryProvider);
  return AuthNotifier(repo);
});
