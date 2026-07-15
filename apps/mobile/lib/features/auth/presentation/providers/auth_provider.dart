import 'dart:async';

import 'package:dartz/dartz.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/auth_repository.dart';
import '../../data/models/session.dart';
import '../../../core/repositories/session_environment.dart';

// ── SessionEnvironment provider ──────────────────────────────
final sessionEnvironmentProvider = Provider<SessionEnvironment>((ref) {
  return SessionEnvironment.instance;
});

// ── Session reactive stream provider ─────────────────────────
/// Emits the current session (or null) reactively.
/// Use this in screens that need to react to auth state changes.
final sessionStateProvider = StreamProvider<Session?>((ref) {
  return SessionEnvironment.instance.dataStream;
});

// ── Forgot password flow state ───────────────────────────────
/// Tracks the forgot password multi-step state.
/// Kept minimal — API calls go through [SessionEnvironment].
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
