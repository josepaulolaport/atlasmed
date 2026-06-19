import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/auth_repository.dart';
import '../providers/auth_provider.dart';
import '../widgets/glass_input.dart';
import '../widgets/primary_button.dart';
import '../widgets/blue_backdrop.dart';
import '../widgets/terms_footer.dart';
import '../widgets/app_logo.dart';

/// Login screen — email + password form with error states and shake animation.
class LoginScreen extends ConsumerStatefulWidget {
  final VoidCallback onForgotPassword;
  final VoidCallback onLoginSuccess;

  const LoginScreen({
    super.key,
    required this.onForgotPassword,
    required this.onLoginSuccess,
  });

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen>
    with SingleTickerProviderStateMixin {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  late AnimationController _shakeController;
  late Animation<double> _shakeAnimation;
  int _shakeCount = 0;

  @override
  void initState() {
    super.initState();
    _shakeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 440),
    );
    _shakeAnimation = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 0, end: -7), weight: 1),
      TweenSequenceItem(tween: Tween(begin: -7, end: 7), weight: 2),
      TweenSequenceItem(tween: Tween(begin: 7, end: -7), weight: 2),
      TweenSequenceItem(tween: Tween(begin: -7, end: 7), weight: 2),
      TweenSequenceItem(tween: Tween(begin: 7, end: 0), weight: 1),
    ]).animate(_shakeController);
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _shakeController.dispose();
    super.dispose();
  }

  void _triggerShake() {
    _shakeCount++;
    _shakeController.forward(from: 0);
  }

  String? _errorMessage(AuthException? e) {
    if (e == null) return null;
    switch (e.kind) {
      case AuthErrorKind.wrongCredentials:
        return 'E-mail ou senha incorretos.';
      case AuthErrorKind.accountLocked:
        return 'Muitas tentativas. Recupere sua senha para continuar.';
      case AuthErrorKind.networkError:
        return 'Sem conexão. Verifique sua internet.';
      default:
        return e.message;
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final errorMsg = _errorMessage(authState.error);
    final isLocked = authState.error?.kind == AuthErrorKind.accountLocked;
    final isLoading = authState.status == AuthStatus.authenticating;

    // Listen for login success
    ref.listen<AuthState>(authProvider, (prev, next) {
      if (next.status == AuthStatus.authenticated && prev?.status != AuthStatus.authenticated) {
        widget.onLoginSuccess();
      }
    });

    // Trigger shake on error
    if (authState.error != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _triggerShake();
      });
    }

    return Scaffold(
      body: Stack(
        children: [
          const BlueBackdrop(),
          SafeArea(
            child: SingleChildScrollView(
              child: Column(
                children: [
                  const SizedBox(height: 40),
                  // Logo
                  const Center(
                    child: AppLogo(size: 120),
                  ),
                  const SizedBox(height: 16),
                  // Title + form
                  Padding(
                    padding: const EdgeInsets.fromLTRB(28, 20, 28, 0),
                    child: AnimatedBuilder(
                      animation: _shakeAnimation,
                      key: ValueKey('login_form_$_shakeCount'),
                      builder: (_, _) {
                        return Transform.translate(
                          offset: Offset(_shakeAnimation.value, 0),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Bem-vindo',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 26,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: -0.4,
                                ),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                'Entre com sua conta para acessar o portal.',
                                style: TextStyle(
                                  color: Colors.white.withValues(alpha: 0.7),
                                  fontSize: 14,
                                ),
                              ),
                              const SizedBox(height: 28),
                              GlassInput(
                                label: 'E-mail corporativo',
                                icon: const Icon(Icons.email_outlined, size: 18),
                                value: _emailController.text,
                                onChanged: (v) {
                                  _emailController.text = v;
                                  _emailController.selection = TextSelection.collapsed(offset: v.length);
                                  ref.read(authProvider.notifier).clearError();
                                },
                                keyboardType: TextInputType.emailAddress,
                                textInputAction: TextInputAction.next,
                                error: authState.error?.kind == AuthErrorKind.wrongCredentials,
                                enabled: !isLocked,
                              ),
                              const SizedBox(height: 12),
                              GlassInput(
                                label: 'Senha',
                                icon: const Icon(Icons.lock_outline, size: 18),
                                value: _passwordController.text,
                                onChanged: (v) {
                                  _passwordController.text = v;
                                  _passwordController.selection = TextSelection.collapsed(offset: v.length);
                                  ref.read(authProvider.notifier).clearError();
                                },
                                obscureText: true,
                                textInputAction: TextInputAction.done,
                                error: authState.error?.kind == AuthErrorKind.wrongCredentials,
                                enabled: !isLocked,
                              ),
                              // Error message
                              const SizedBox(height: 12),
                              if (errorMsg != null)
                                Row(
                                  children: [
                                    const Icon(
                                      Icons.error_outline,
                                      color: Color(0xE6FFB4B4),
                                      size: 14,
                                    ),
                                    const SizedBox(width: 6),
                                    Flexible(
                                      child: Text(
                                        errorMsg,
                                        style: const TextStyle(
                                          color: Color(0xE6FFB4B4),
                                          fontSize: 12.5,
                                          fontWeight: FontWeight.w500,
                                        ),
                                      ),
                                    ),
                                  ],
                                )
                              else
                                const SizedBox(height: 20),
                              // Forgot password
                              Align(
                                alignment: Alignment.centerRight,
                                child: TextButton(
                                  onPressed: widget.onForgotPassword,
                                  style: TextButton.styleFrom(
                                    padding: const EdgeInsets.symmetric(horizontal: 4),
                                  ),
                                  child: Text(
                                    'Esqueci minha senha',
                                    style: TextStyle(
                                      color: Colors.white.withValues(alpha: 0.85),
                                      fontSize: 13,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 8),
                              PrimaryButton(
                                label: 'Entrar',
                                loading: isLoading,
                                disabled: _emailController.text.isEmpty ||
                                    _passwordController.text.isEmpty ||
                                    isLocked,
                                trailingIcon: Icons.arrow_forward,
                                onPressed: () => ref
                                    .read(authProvider.notifier)
                                    .login(
                                      _emailController.text,
                                      _passwordController.text,
                                    ),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
          ),
          // Terms footer
          const Positioned(
            bottom: 24,
            left: 0,
            right: 0,
            child: TermsFooter(),
          ),
        ],
      ),
    );
  }
}
