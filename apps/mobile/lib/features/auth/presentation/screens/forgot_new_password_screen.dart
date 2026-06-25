import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/auth_provider.dart';
import '../widgets/glass_input.dart';
import '../widgets/primary_button.dart';
import '../widgets/blue_backdrop.dart';
import '../widgets/app_back_button.dart';

/// Forgot password — step 3: new password with strength checklist.
class ForgotNewPasswordScreen extends ConsumerStatefulWidget {
  final VoidCallback onBack;
  final VoidCallback onSuccess;

  const ForgotNewPasswordScreen({
    super.key,
    required this.onBack,
    required this.onSuccess,
  });

  @override
  ConsumerState<ForgotNewPasswordScreen> createState() =>
      _ForgotNewPasswordScreenState();
}

class _ForgotNewPasswordScreenState
    extends ConsumerState<ForgotNewPasswordScreen> {
  final _newPwController = TextEditingController();
  final _confirmPwController = TextEditingController();


  @override
  void dispose() {
    _newPwController.dispose();
    _confirmPwController.dispose();
    super.dispose();
  }

  bool _getCheck(String key) {
    final pw = _newPwController.text;
    switch (key) {
      case 'length':
        return pw.length >= 8;
      case 'number':
        return RegExp(r'\d').hasMatch(pw);
      case 'upper':
        return RegExp(r'[A-Z]').hasMatch(pw);
      case 'match':
        return pw.isNotEmpty && pw == _confirmPwController.text;
      default:
        return false;
    }
  }

  bool get _allValid =>
      _getCheck('length') &&
      _getCheck('number') &&
      _getCheck('upper') &&
      _getCheck('match');

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(authProvider);
    final isLoading = state.status == AuthStatus.authenticating;

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
                          'Passo 3 de 3',
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
                          'Crie uma nova senha',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 26,
                            fontWeight: FontWeight.w700,
                            letterSpacing: -0.4,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Escolha uma senha forte que você não usou antes.',
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.7),
                            fontSize: 14,
                          ),
                        ),
                        const SizedBox(height: 24),
                        GlassInput(
                          label: 'Nova senha',
                          icon: const Icon(Icons.lock_outline, size: 18),
                          value: _newPwController.text,
                          onChanged: (v) {
                            _newPwController.text = v;
                            _newPwController.selection =
                                TextSelection.collapsed(offset: v.length);
                            setState(() {});
                          },
                          obscureText: true,
                        ),
                        const SizedBox(height: 12),
                        GlassInput(
                          label: 'Confirmar senha',
                          icon: const Icon(Icons.lock_outline, size: 18),
                          value: _confirmPwController.text,
                          onChanged: (v) {
                            _confirmPwController.text = v;
                            _confirmPwController.selection =
                                TextSelection.collapsed(offset: v.length);
                            setState(() {});
                          },
                          obscureText: true,
                         ),
                        const SizedBox(height: 16),
                        // Strength checklist
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(12),
                            color: Colors.white.withValues(alpha: 0.06),
                            border: Border.all(
                              color: Colors.white.withValues(alpha: 0.12),
                            ),
                          ),
                          child: Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              _checkItem('Mín. 8 caracteres', _getCheck('length')),
                              _checkItem('Um número', _getCheck('number')),
                              _checkItem('Uma maiúscula', _getCheck('upper')),
                              _checkItem('Senhas iguais', _getCheck('match')),
                            ],
                          ),
                        ),
                        const SizedBox(height: 20),
                        PrimaryButton(
                          label: 'Salvar nova senha',
                          loading: isLoading,
                          disabled: !_allValid,
                          onPressed: () {
                            ref
                                .read(authProvider.notifier)
                                .submitNewPassword(
                                  _newPwController.text,
                                  _confirmPwController.text,
                                )
                                .then((_) {
                              final st = ref.read(authProvider);
                              if (st.forgotStep == 3) {
                                widget.onSuccess();
                              }
                            });
                          },
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

  Widget _checkItem(String label, bool valid) {
    return SizedBox(
      width: (MediaQuery.of(context).size.width - 28 * 2 - 12 * 2 - 12 * 2) / 2,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            width: 14,
            height: 14,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: valid ? const Color(0xE648BB78) : Colors.white.withValues(alpha: 0.12),
              border: valid
                  ? Border.all(width: 0, color: Colors.transparent)
                  : Border.all(color: Colors.white.withValues(alpha: 0.25)),
            ),
            child: valid
                ? const Icon(Icons.check, color: Colors.white, size: 10)
                : null,
          ),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 11,
                color: valid
                    ? const Color(0xE6B4FFD2)
                    : Colors.white.withValues(alpha: 0.5),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
