import 'package:flutter/material.dart';
import '../widgets/primary_button.dart';
import '../widgets/blue_backdrop.dart';

/// Forgot password — success screen shown after password is reset.
class ForgotSuccessScreen extends StatefulWidget {
  final VoidCallback onBackToLogin;

  const ForgotSuccessScreen({super.key, required this.onBackToLogin});

  @override
  State<ForgotSuccessScreen> createState() => _ForgotSuccessScreenState();
}

class _ForgotSuccessScreenState extends State<ForgotSuccessScreen> {
  @override
  void initState() {
    super.initState();
    // Auto-redirect after 3.2s
    Future.delayed(const Duration(milliseconds: 3200), () {
      if (mounted) widget.onBackToLogin();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          const BlueBackdrop(),
          Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 28),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Check circle animation
                  Container(
                    width: 96,
                    height: 96,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: const Color(0x2E48BB78),
                      border: Border.all(
                        color: const Color(0x9948BB78),
                        width: 1.5,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0x5948BB78),
                          blurRadius: 60,
                        ),
                      ],
                    ),
                    child: const Icon(
                      Icons.check,
                      color: Color(0xE6B4FFD2),
                      size: 48,
                    ),
                  ),
                  const SizedBox(height: 28),
                  const Text(
                    'Senha atualizada',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 26,
                      fontWeight: FontWeight.w700,
                      letterSpacing: -0.4,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'Sua senha foi redefinida com segurança.\nVocê já pode acessar o portal.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.7),
                      fontSize: 14,
                      height: 1.5,
                    ),
                  ),
                  const SizedBox(height: 40),
                  PrimaryButton(
                    label: 'Voltar ao login',
                    onPressed: widget.onBackToLogin,
                    width: 320,
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
