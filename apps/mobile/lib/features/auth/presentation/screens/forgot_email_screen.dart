import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/auth_provider.dart';
import '../widgets/glass_input.dart';
import '../widgets/primary_button.dart';
import '../widgets/blue_backdrop.dart';
import '../widgets/app_back_button.dart';

/// Forgot password — step 1: submit email.
class ForgotEmailScreen extends ConsumerWidget {
  final VoidCallback onBack;
  final VoidCallback onCodeSent;

  const ForgotEmailScreen({
    super.key,
    required this.onBack,
    required this.onCodeSent,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(authProvider);
    final email = TextEditingController(text: state.forgotEmail);

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
                        AppBackButton(onTap: onBack),
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
                        // Mail icon container
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
                          'Digite o e-mail cadastrado. Enviaremos um código de 6 dígitos para você.',
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.7),
                            fontSize: 14,
                            height: 1.5,
                          ),
                        ),
                        const SizedBox(height: 28),
                        GlassInput(
                          label: 'E-mail corporativo',
                          value: email.text,
                          onChanged: (v) => email.text = v,
                          keyboardType: TextInputType.emailAddress,
                          icon: const Icon(Icons.email_outlined, size: 18),
                        ),
                        const SizedBox(height: 24),
                        PrimaryButton(
                          label: 'Enviar código',
                          loading: false,
                          disabled: !email.text.contains('@'),
                          onPressed: () {
                            ref
                                .read(authProvider.notifier)
                                .submitForgotEmail(email.text)
                                .then((_) {
                              final st = ref.read(authProvider);
                              if (st.error == null) {
                                onCodeSent();
                              }
                            });
                          },
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
                                onPressed: onBack,
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
