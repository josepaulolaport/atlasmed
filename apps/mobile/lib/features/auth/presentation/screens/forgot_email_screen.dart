import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/auth_provider.dart';
import '../widgets/glass_input.dart';
import '../widgets/primary_button.dart';
import '../widgets/blue_backdrop.dart';
import '../widgets/app_back_button.dart';

/// Forgot password — step 1: submit email.
class ForgotEmailScreen extends ConsumerStatefulWidget {
  final VoidCallback onBack;
  final VoidCallback onCodeSent;

  const ForgotEmailScreen({
    super.key,
    required this.onBack,
    required this.onCodeSent,
  });

  @override
  ConsumerState<ForgotEmailScreen> createState() => _ForgotEmailScreenState();
}

class _ForgotEmailScreenState extends ConsumerState<ForgotEmailScreen> {
  String _email = '';
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final saved = ref.read(authProvider).forgotEmail;
      if (saved.isNotEmpty && mounted) {
        setState(() => _email = saved);
      }
    });
  }

  bool get _isValidEmail {
    final value = _email.trim();
    return value.contains('@') && value.contains('.');
  }

  Future<void> _handleSubmit() async {
    if (!_isValidEmail || _submitting) return;

    setState(() => _submitting = true);

    try {
      await ref.read(authProvider.notifier).submitForgotEmail(_email.trim());

      if (!mounted) return;

      final st = ref.read(authProvider);
      if (st.error != null) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'E-mail enviado para ${_email.trim()}. Verifique sua caixa de entrada.',
          ),
          behavior: SnackBarBehavior.floating,
        ),
      );

      widget.onCodeSent();
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(authProvider);
    final hasError = state.error != null;

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
                          'Passo 1 de 3',
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
                            Icons.email_outlined,
                            color: Colors.white,
                            size: 28,
                          ),
                        ),
                        const SizedBox(height: 20),
                        const Text(
                          'Recuperar senha',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 26,
                            fontWeight: FontWeight.w700,
                            letterSpacing: -0.4,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Digite o e-mail cadastrado. Enviaremos um código de recuperação.',
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.7),
                            fontSize: 14,
                            height: 1.5,
                          ),
                        ),
                        const SizedBox(height: 28),
                        GlassInput(
                          label: 'E-mail corporativo',
                          value: _email,
                          onChanged: (value) {
                            setState(() => _email = value);
                            ref.read(authProvider.notifier).clearError();
                          },
                          keyboardType: TextInputType.emailAddress,
                          icon: const Icon(Icons.email_outlined, size: 18),
                          error: hasError,
                        ),
                        if (hasError) ...[
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              const Icon(
                                Icons.error_outline,
                                color: Color(0xE6FFB4B4),
                                size: 14,
                              ),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Text(
                                  state.error!.message,
                                  style: const TextStyle(
                                    color: Color(0xE6FFB4B4),
                                    fontSize: 12,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                        const SizedBox(height: 24),
                        PrimaryButton(
                          label: 'Enviar e-mail',
                          loading: _submitting,
                          disabled: !_isValidEmail,
                          onPressed: _handleSubmit,
                        ),
                        const SizedBox(height: 20),
                        Center(
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                'Lembrou? ',
                                style: TextStyle(
                                  color: Colors.white.withValues(alpha: 0.65),
                                  fontSize: 13,
                                ),
                              ),
                              TextButton(
                                onPressed: widget.onBack,
                                style: TextButton.styleFrom(padding: EdgeInsets.zero),
                                child: const Text(
                                  'Voltar ao login',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w600,
                                    fontSize: 13,
                                  ),
                                ),
                              ),
                            ],
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
