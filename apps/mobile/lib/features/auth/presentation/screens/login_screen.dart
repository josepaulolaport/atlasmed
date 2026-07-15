import 'package:another_flushbar/flushbar.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:atlasmed_mobile_app/core/providers/session_provider.dart';
import 'package:atlasmed_mobile_app/core/repositories/session_environment.dart';
import 'package:atlasmed_mobile_app/repository/repository_flutter.dart';
import 'package:atlasmed_mobile_app/features/auth/data/auth_repository.dart';
import 'package:atlasmed_mobile_app/features/auth/data/models/session.dart';
import 'package:atlasmed_mobile_app/features/auth/presentation/widgets/app_logo.dart';
import 'package:atlasmed_mobile_app/features/auth/presentation/widgets/blue_backdrop.dart';
import 'package:atlasmed_mobile_app/features/auth/presentation/widgets/glass_input.dart';
import 'package:atlasmed_mobile_app/features/auth/presentation/widgets/primary_button.dart';
import 'package:atlasmed_mobile_app/features/auth/presentation/widgets/terms_footer.dart';

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
  bool _isLoading = false;
  AuthErrorKind? _errorKind;

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

  String _errorMessage(AuthErrorKind errorKind) {
    switch (errorKind) {
      case AuthErrorKind.wrongCredentials:
        return 'E-mail ou senha incorretos.';
      case AuthErrorKind.accountLocked:
        return 'Muitas tentativas. Recupere sua senha para continuar.';
      case AuthErrorKind.networkError:
        return 'Sem conexão. Verifique sua internet.';
      case AuthErrorKind.invalidCode:
        return 'Código inválido. Confira e tente novamente.';
      case AuthErrorKind.expiredCode:
        return 'Código expirado. Solicite um novo código.';
      case AuthErrorKind.emailNotFound:
        return 'E-mail não encontrado.';
      case AuthErrorKind.unknown:
        return 'Erro ao fazer login. Tente novamente.';
    }
  }

  Future<void> _showErrorFlushbar(AuthErrorKind errorKind) async {
    if (!mounted) return;

    await Flushbar<void>(
      icon: const Icon(Icons.error_outline, color: Colors.white, size: 20),
      shouldIconPulse: false,
      messageText: Text(
        _errorMessage(errorKind),
        style: const TextStyle(
          color: Colors.white,
          fontSize: 14,
          fontWeight: FontWeight.w500,
        ),
      ),
      backgroundColor: const Color(0xFFDC2626),
      flushbarStyle: FlushbarStyle.GROUNDED,
      flushbarPosition: FlushbarPosition.TOP,
      duration: const Duration(seconds: 3),
    ).show(context);
  }

  void _clearError() {
    if (_errorKind != null) {
      setState(() => _errorKind = null);
    }
  }

  Future<void> _login(SessionEnvironment repository) async {
    if (_isLoading) return;

    setState(() {
      _isLoading = true;
      _errorKind = null;
    });

    final result = await repository.login(
      email: _emailController.text,
      password: _passwordController.text,
    );

    if (!mounted) return;

    result.fold(
      (errorKind) {
        setState(() {
          _isLoading = false;
          _errorKind = errorKind;
        });
        _triggerShake();
        _showErrorFlushbar(errorKind);
      },
      (_) {
        setState(() => _isLoading = false);
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final sessionEnvironment = ref.watch(sessionProvider);

    return RepositoryBuilder<SessionEnvironment, Session?>(
      repository: sessionEnvironment,
      builder: (context, Session? session, repository) {
        final isLocked = _errorKind == AuthErrorKind.accountLocked;
        final hasWrongCredentials =
            _errorKind == AuthErrorKind.wrongCredentials;

        return Scaffold(
          body: Stack(
            children: [
              const BlueBackdrop(),
              SafeArea(
                child: SingleChildScrollView(
                  child: Column(
                    children: [
                      const SizedBox(height: 40),
                      const Center(child: AppLogo(size: 120)),
                      const SizedBox(height: 16),
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
                                      color: Colors.white.withValues(
                                        alpha: 0.7,
                                      ),
                                      fontSize: 14,
                                    ),
                                  ),
                                  const SizedBox(height: 28),
                                  GlassInput(
                                    label: 'E-mail corporativo',
                                    icon: const Icon(
                                      Icons.email_outlined,
                                      size: 18,
                                    ),
                                    value: _emailController.text,
                                    onChanged: (v) {
                                      _emailController.text = v;
                                      _emailController.selection =
                                          TextSelection.collapsed(
                                            offset: v.length,
                                          );
                                      _clearError();
                                    },
                                    keyboardType: TextInputType.emailAddress,
                                    textInputAction: TextInputAction.next,
                                    error: hasWrongCredentials,
                                    enabled: !isLocked && !_isLoading,
                                  ),
                                  const SizedBox(height: 12),
                                  GlassInput(
                                    label: 'Senha',
                                    icon: const Icon(
                                      Icons.lock_outline,
                                      size: 18,
                                    ),
                                    value: _passwordController.text,
                                    onChanged: (v) {
                                      _passwordController.text = v;
                                      _passwordController.selection =
                                          TextSelection.collapsed(
                                            offset: v.length,
                                          );
                                      _clearError();
                                    },
                                    obscureText: true,
                                    textInputAction: TextInputAction.done,
                                    error: hasWrongCredentials,
                                    enabled: !isLocked && !_isLoading,
                                  ),
                                  const SizedBox(height: 32),
                                  Align(
                                    alignment: Alignment.centerRight,
                                    child: TextButton(
                                      onPressed: widget.onForgotPassword,
                                      style: TextButton.styleFrom(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 4,
                                        ),
                                      ),
                                      child: Text(
                                        'Esqueci minha senha',
                                        style: TextStyle(
                                          color: Colors.white.withValues(
                                            alpha: 0.85,
                                          ),
                                          fontSize: 13,
                                          fontWeight: FontWeight.w500,
                                        ),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  PrimaryButton(
                                    label: 'Entrar',
                                    loading: _isLoading,
                                    disabled:
                                        _emailController.text.isEmpty ||
                                        _passwordController.text.isEmpty ||
                                        isLocked,
                                    trailingIcon: Icons.arrow_forward,
                                    onPressed: () => _login(repository),
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
              const Positioned(
                bottom: 24,
                left: 0,
                right: 0,
                child: TermsFooter(),
              ),
            ],
          ),
        );
      },
    );
  }
}
