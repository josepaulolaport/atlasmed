import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/config/api_config.dart';
import '../../../../core/network/api_client.dart';
import '../../data/api_auth_repository.dart';
import '../../data/auth_repository.dart';
import '../../data/models.dart';
import '../../data/mock_auth_repository.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  if (ApiConfig.useMockAuth) {
    return MockAuthRepository();
  }
  return ApiAuthRepository(
    apiClient: ref.watch(apiClientProvider),
    tokenStorage: ref.watch(tokenStorageProvider),
  );
});

enum AuthStatus {
  unknown,
  unauthenticated,
  authenticating,
  authenticated,
}

class AuthState {
  final AuthStatus status;
  final AuthSession? session;
  final AuthException? error;
  final int forgotStep;
  final String forgotEmail;
  final String resetToken;
  final String newPassword;
  final String confirmPassword;

  const AuthState({
    this.status = AuthStatus.unknown,
    this.session,
    this.error,
    this.forgotStep = 0,
    this.forgotEmail = '',
    this.resetToken = '',
    this.newPassword = '',
    this.confirmPassword = '',
  });

  AuthState copyWith({
    AuthStatus? status,
    AuthSession? session,
    AuthException? error,
    int? forgotStep,
    String? forgotEmail,
    String? resetToken,
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
      resetToken: resetToken ?? this.resetToken,
      newPassword: newPassword ?? this.newPassword,
      confirmPassword: confirmPassword ?? this.confirmPassword,
    );
  }
}

class AuthNotifier extends StateNotifier<AuthState> {
  final AuthRepository _repository;

  AuthNotifier(this._repository) : super(const AuthState());

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

  Future<void> submitForgotEmail(String email) async {
    state = state.copyWith(forgotEmail: email, error: null, clearError: true);

    try {
      await _repository.requestPasswordReset(
        ForgotPasswordRequest(email: email),
      );
      state = state.copyWith(forgotStep: 1, error: null);
    } on AuthException catch (e) {
      state = state.copyWith(error: e);
    } catch (e) {
      state = state.copyWith(
        error: AuthException(
          kind: AuthErrorKind.networkError,
          message: 'Não foi possível enviar o e-mail. Verifique sua conexão.',
        ),
      );
    }
  }

  Future<bool> submitResetToken(String token) async {
    final trimmed = token.trim();

    if (trimmed.length < 8) {
      state = state.copyWith(
        error: const AuthException(
          kind: AuthErrorKind.invalidCode,
          message: 'Cole o código completo recebido por e-mail.',
        ),
      );
      return false;
    }

    try {
      await _repository.validateResetToken(trimmed);
      state = state.copyWith(resetToken: trimmed, forgotStep: 2, error: null);
      return true;
    } on AuthException catch (e) {
      state = state.copyWith(error: e);
      return false;
    } catch (_) {
      state = state.copyWith(
        error: const AuthException(
          kind: AuthErrorKind.networkError,
          message: 'Não foi possível validar o código. Tente novamente.',
        ),
      );
      return false;
    }
  }

  Future<void> submitNewPassword(String newPassword, String confirmPassword) async {
    state = state.copyWith(newPassword: newPassword, confirmPassword: confirmPassword);

    try {
      await _repository.resetPassword(
        ResetPasswordRequest(
          token: state.resetToken,
          newPassword: newPassword,
        ),
      );
      state = state.copyWith(forgotStep: 3, error: null);
    } on AuthException catch (e) {
      state = state.copyWith(error: e);
    }
  }

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

  void backToLogin() {
    state = state.copyWith(
      forgotStep: 0,
      forgotEmail: '',
      resetToken: '',
      newPassword: '',
      confirmPassword: '',
      error: null,
    );
  }

  Future<void> logout() async {
    await _repository.clearSession();
    state = const AuthState(status: AuthStatus.unauthenticated);
  }

  void clearError() {
    state = state.copyWith(clearError: true);
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final repo = ref.watch(authRepositoryProvider);
  return AuthNotifier(repo);
});
