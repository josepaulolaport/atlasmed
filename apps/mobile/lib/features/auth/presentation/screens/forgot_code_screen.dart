import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/auth_repository.dart';
import '../providers/auth_provider.dart';
import '../widgets/primary_button.dart';
import '../widgets/blue_backdrop.dart';
import '../widgets/app_back_button.dart';
import '../widgets/glass_input.dart';

/// Forgot password — step 2: paste reset token from email.
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
  String _token = '';
  bool _validating = false;

  Future<void> _handleVerify() async {
    if (_validating) return;

    setState(() => _validating = true);

    try {
      final ok = await ref.read(authProvider.notifier).submitResetToken(_token);
      if (ok && mounted) {
        widget.onCodeVerified();
      }
    } finally {
      if (mounted) {
        setState(() => _validating = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(authProvider);
    final tokenError = state.error?.kind == AuthErrorKind.invalidCode ||
        state.error?.kind == AuthErrorKind.expiredCode;

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
                          'Cole o código do e-mail',
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
                              const TextSpan(
                                text: 'Verifique seu e-mail e cole o código de recuperação enviado para\n',
                              ),
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
                        GlassInput(
                          label: 'Código de recuperação',
                          value: _token,
                          onChanged: (value) {
                            setState(() => _token = value);
                            ref.read(authProvider.notifier).clearError();
                          },
                          error: tokenError,
                        ),
                        if (tokenError) ...[
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              const Icon(
                                Icons.error_outline,
                                color: Color(0xE6FFB4B4),
                                size: 14,
                              ),
                              const SizedBox(width: 6),
                              Text(
                                state.error?.message ?? 'Código inválido.',
                                style: const TextStyle(
                                  color: Color(0xE6FFB4B4),
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ],
                        const SizedBox(height: 24),
                        PrimaryButton(
                          label: 'Continuar',
                          loading: _validating,
                          disabled: _token.trim().length < 8,
                          onPressed: _handleVerify,
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
