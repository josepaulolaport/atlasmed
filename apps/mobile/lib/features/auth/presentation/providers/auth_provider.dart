import 'package:flutter_riverpod/flutter_riverpod.dart';

class ForgotPasswordState {
  final String email;
  final String code;
  final String newPassword;

  const ForgotPasswordState({
    this.email = '',
    this.code = '',
    this.newPassword = '',
  });

  ForgotPasswordState copyWith({
    String? email,
    String? code,
    String? newPassword,
  }) {
    return ForgotPasswordState(
      email: email ?? this.email,
      code: code ?? this.code,
      newPassword: newPassword ?? this.newPassword,
    );
  }
}

class ForgotPasswordNotifier extends StateNotifier<ForgotPasswordState> {
  ForgotPasswordNotifier() : super(const ForgotPasswordState());

  void setEmail(String email) => state = state.copyWith(email: email);
  void setCode(String code) => state = state.copyWith(code: code);
  void setNewPassword(String pw) => state = state.copyWith(newPassword: pw);
  void reset() => state = const ForgotPasswordState();
}

final forgotPasswordProvider =
    StateNotifierProvider<ForgotPasswordNotifier, ForgotPasswordState>((ref) {
      return ForgotPasswordNotifier();
    });
