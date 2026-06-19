import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/auth_repository.dart';
import '../providers/auth_provider.dart';
import '../widgets/code_input.dart';
import '../widgets/primary_button.dart';
import '../widgets/blue_backdrop.dart';
import '../widgets/app_back_button.dart';

/// Forgot password — step 2: 6-digit code verification.
class ForgotCodeScreen extends ConsumerStatefulWidget {
  final VoidCallback onBack;
  final VoidCallback onCodeVerified;

  const ForgotCodeScreen({
    super.key,
    required this.onBack,
    required this.onCodeVerified,
  });

  @override
  ConsumerState<ForgotCodeScreen> createState() => _ForgotCodeScreenState();
}

class _ForgotCodeScreenState extends ConsumerState<ForgotCodeScreen> {
  String _code = '';
  int _cooldown = 42;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _startCooldown();
  }

  void _startCooldown() {
    _cooldown = 42;
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (_cooldown > 0) {
        setState(() => _cooldown--);
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _handleVerify() async {
    final ok = await ref.read(authProvider.notifier).submitCode(_code);
    if (ok && mounted) {
      widget.onCodeVerified();
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(authProvider);
    final isLoading = state.status == AuthStatus.authenticating;
    final codeError = state.error?.kind == AuthErrorKind.invalidCode;

    return Scaffold(
      body: Stack(
        children: [
          const BlueBackdrop(),
          SafeArea(
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 40),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 24),
                    child: Row(
                      children: [
                        AppBackButton(onTap: widget.onBack),
                        const SizedBox(width: 12),
                        Text(
                          'Passo 2 de 3',
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.7),
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(28, 32, 28, 0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 64,
                          height: 64,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(18),
                            color: Colors.white.withValues(alpha: 0.12),
                            border: Border.all(
                              color: Colors.white.withValues(alpha: 0.2),
                            ),
                          ),
                          child: const Icon(
                            Icons.lock_outline,
                            color: Colors.white,
                            size: 28,
                          ),
                        ),
                        const SizedBox(height: 20),
                        const Text(
                          'Verifique seu e-mail',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 26,
                            fontWeight: FontWeight.w700,
                            letterSpacing: -0.4,
                          ),
                        ),
                        const SizedBox(height: 8),
                        RichText(
                          text: TextSpan(
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.7),
                              fontSize: 14,
                              height: 1.5,
                            ),
                            children: [
                              const TextSpan(text: 'Enviamos um código para\n'),
                              TextSpan(
                                text: state.forgotEmail,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 28),
                        CodeInput(
                          value: _code,
                          onChanged: (v) {
                            setState(() => _code = v);
                            ref.read(authProvider.notifier).clearError();
                          },
                          error: codeError,
                        ),
                        if (codeError) ...[
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              const Icon(
                                Icons.error_outline,
                                color: Color(0xE6FFB4B4),
                                size: 14,
                              ),
                              const SizedBox(width: 6),
                              const Text(
                                'Código inválido. Confira e tente novamente.',
                                style: TextStyle(
                                  color: Color(0xE6FFB4B4),
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ],
                        const SizedBox(height: 24),
                        PrimaryButton(
                          label: 'Verificar código',
                          loading: isLoading,
                          disabled: _code.length < 6,
                          onPressed: _handleVerify,
                        ),
                        const SizedBox(height: 20),
                        Center(
                          child: _cooldown > 0
                              ? Text(
                                  'Reenviar código em 0:${_cooldown.toString().padLeft(2, '0')}',
                                  style: TextStyle(
                                    color: Colors.white.withValues(alpha: 0.65),
                                    fontSize: 13,
                                  ),
                                )
                              : TextButton(
                                  onPressed: () {
                                    // Resend logic
                                    _startCooldown();
                                  },
                                  style: TextButton.styleFrom(padding: EdgeInsets.zero),
                                  child: const Text(
                                    'Reenviar código',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w600,
                                      fontSize: 13,
                                    ),
                                  ),
                                ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
