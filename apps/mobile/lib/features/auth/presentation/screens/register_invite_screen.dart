import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'package:atlasmed_mobile_app/features/auth/data/person_name_match.dart';
import 'package:atlasmed_mobile_app/features/auth/data/repositories/invite_registration_repository.dart';
import 'package:atlasmed_mobile_app/features/auth/presentation/widgets/app_back_button.dart';
import 'package:atlasmed_mobile_app/features/auth/presentation/widgets/blue_backdrop.dart';
import 'package:atlasmed_mobile_app/features/auth/presentation/widgets/glass_input.dart';
import 'package:atlasmed_mobile_app/features/auth/presentation/widgets/primary_button.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Accept-invite registration — confirm identity, choose username/password.
/// Manager and territory come from the invite and are not shown here.
class RegisterInviteScreen extends StatefulWidget {
  const RegisterInviteScreen({
    super.key,
    required this.onBackToLogin,
    required this.onRegistered,
    this.initialToken,
  });

  final VoidCallback onBackToLogin;
  final VoidCallback onRegistered;
  final String? initialToken;

  @override
  State<RegisterInviteScreen> createState() => _RegisterInviteScreenState();
}

class _RegisterInviteScreenState extends State<RegisterInviteScreen> {
  final _repo = InviteRegistrationRepository();

  final _tokenController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  DateTime? _birthDate;

  InviteValidation? _validated;
  String? _registrationToken;
  String? _error;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    final initial = widget.initialToken?.trim();
    if (initial != null && initial.isNotEmpty) {
      _tokenController.text = initial;
    }
  }

  @override
  void dispose() {
    _tokenController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _usernameController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _firstNameController.dispose();
    _lastNameController.dispose();
    super.dispose();
  }

  bool get _onFormStep =>
      _validated != null && (_registrationToken?.isNotEmpty ?? false);

  void _bindInviteFields(InviteValidation validated) {
    _emailController.text = validated.email?.trim() ?? '';
    _phoneController.text = validated.phoneNumber?.trim() ?? '';
    // Names and DOB are confirmation fields — user types them.
    _firstNameController.clear();
    _lastNameController.clear();
    _birthDate = null;
  }

  Future<void> _validateToken() async {
    final token = _tokenController.text.trim();
    if (token.isEmpty || _loading) return;

    setState(() {
      _loading = true;
      _error = null;
      _validated = null;
      _registrationToken = null;
    });

    try {
      final validated = await _repo.validateToken(token);
      if (!mounted) return;
      setState(() {
        _validated = validated;
        _registrationToken = token;
        _bindInviteFields(validated);
        _loading = false;
      });
    } on InviteRegistrationException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Não foi possível validar o token. Tente novamente.';
        _loading = false;
      });
    }
  }

  bool _passwordOk(String p) =>
      p.length >= 8 &&
      RegExp(r'[A-Z]').hasMatch(p) &&
      RegExp(r'[a-z]').hasMatch(p) &&
      RegExp(r'[0-9]').hasMatch(p) &&
      RegExp(r'[^A-Za-z0-9]').hasMatch(p);

  Future<void> _pickBirthDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _birthDate ?? DateTime(now.year - 30),
      firstDate: DateTime(1940),
      lastDate: now,
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(primary: AppColors.navyDeep),
          ),
          child: child!,
        );
      },
    );
    if (picked != null && mounted) {
      setState(() {
        _birthDate = picked;
        _error = null;
      });
    }
  }

  Future<void> _submitRegistration() async {
    if (!_onFormStep || _loading) return;

    final token = _registrationToken!;
    final invite = _validated!;
    final email = _emailController.text.trim();
    final phone = _phoneController.text.trim();
    final username = _usernameController.text.trim();
    final password = _passwordController.text;
    final confirmPassword = _confirmPasswordController.text;
    final firstName = _firstNameController.text.trim();
    final lastName = _lastNameController.text.trim();

    if (firstName.isEmpty) {
      setState(() => _error = 'Confirme seu nome.');
      return;
    }
    if (lastName.isEmpty) {
      setState(() => _error = 'Confirme seu sobrenome.');
      return;
    }
    if (invite.expectedFullName.isNotEmpty &&
        !namesFuzzyMatch(invite.expectedFullName, '$firstName $lastName')) {
      setState(
        () => _error =
            'O nome não confere com o convite. Confirme ao menos parte do nome completo.',
      );
      return;
    }
    if (_birthDate == null) {
      setState(() => _error = 'Confirme sua data de nascimento.');
      return;
    }
    if (email.isEmpty || !email.contains('@')) {
      setState(() => _error = 'Informe um e-mail válido.');
      return;
    }
    if (invite.emailLocked && email != invite.email!.trim()) {
      setState(
        () => _error =
            'O e-mail deve ser o mesmo do convite (${invite.email!.trim()}).',
      );
      return;
    }
    if (invite.phoneLocked && phone != invite.phoneNumber!.trim()) {
      setState(
        () => _error =
            'O telefone deve ser o mesmo do convite (${invite.phoneNumber!.trim()}).',
      );
      return;
    }
    if (invite.phoneLocked && phone.isEmpty) {
      setState(() => _error = 'Informe o telefone do convite.');
      return;
    }
    if (username.length < 3) {
      setState(() => _error = 'O usuário precisa ter pelo menos 3 caracteres.');
      return;
    }
    if (!_passwordOk(password)) {
      setState(
        () => _error =
            'A senha precisa ter 8+ caracteres, maiúscula, minúscula, número e símbolo.',
      );
      return;
    }
    if (password != confirmPassword) {
      setState(() => _error = 'As senhas não coincidem.');
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      await _repo.validateToken(token);
      await _repo.register(
        token: token,
        email: email,
        username: username,
        password: password,
        phoneNumber: phone.isEmpty ? null : phone,
        firstName: firstName,
        lastName: lastName,
        birthDate: _birthDate!,
      );
      if (!mounted) return;
      widget.onRegistered();
    } on InviteRegistrationException catch (e) {
      if (!mounted) return;
      final resetToken =
          e.message.toLowerCase().contains('invite') ||
          e.message.toLowerCase().contains('token');
      setState(() {
        _error = e.message;
        _loading = false;
        if (resetToken) {
          _validated = null;
          _registrationToken = null;
        }
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Falha no cadastro. Tente novamente.';
        _loading = false;
      });
    }
  }

  void _onFieldChanged(TextEditingController controller, String value) {
    setState(() {
      controller.text = value;
      controller.selection = TextSelection.collapsed(offset: value.length);
      _error = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final invite = _validated;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
        statusBarBrightness: Brightness.dark,
      ),
      child: Scaffold(
        resizeToAvoidBottomInset: true,
        body: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
          child: Stack(
            children: [
              const BlueBackdrop(),
              SafeArea(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(28, 24, 28, 40),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          AppBackButton(
                            onTap: _onFormStep
                                ? () => setState(() {
                                    _validated = null;
                                    _registrationToken = null;
                                    _error = null;
                                  })
                                : widget.onBackToLogin,
                          ),
                          const SizedBox(width: 12),
                          Text(
                            _onFormStep ? 'Passo 2 de 2' : 'Passo 1 de 2',
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.7),
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 28),
                      Text(
                        _onFormStep
                            ? 'Confirme sua identidade'
                            : 'Junte-se ao AtlasMed',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 26,
                          fontWeight: FontWeight.w700,
                          letterSpacing: -0.4,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _onFormStep
                            ? 'Digite seu nome e data de nascimento para confirmar o convite, depois escolha usuário e senha.'
                            : 'Cole o código recebido por e-mail ou WhatsApp.',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.7),
                          fontSize: 14,
                          height: 1.5,
                        ),
                      ),
                      const SizedBox(height: 28),
                      if (!_onFormStep) ...[
                        GlassInput(
                          label: 'Código de cadastro',
                          value: _tokenController.text,
                          onChanged: (v) =>
                              _onFieldChanged(_tokenController, v),
                          enabled: !_loading,
                        ),
                      ] else ...[
                        if (invite != null) ...[
                          Text(
                            'Perfil: ${invite.roleName}',
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.75),
                              fontSize: 13,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          const SizedBox(height: 16),
                        ],
                        GlassInput(
                          label: 'Nome',
                          value: _firstNameController.text,
                          onChanged: (v) =>
                              _onFieldChanged(_firstNameController, v),
                          enabled: !_loading,
                        ),
                        const SizedBox(height: 12),
                        GlassInput(
                          label: 'Sobrenome',
                          value: _lastNameController.text,
                          onChanged: (v) =>
                              _onFieldChanged(_lastNameController, v),
                          enabled: !_loading,
                        ),
                        const SizedBox(height: 12),
                        _BirthDateField(
                          value: _birthDate,
                          enabled: !_loading,
                          onTap: _pickBirthDate,
                        ),
                        const SizedBox(height: 12),
                        GlassInput(
                          label: invite?.emailLocked == true
                              ? 'E-mail do convite'
                              : 'E-mail',
                          value: _emailController.text,
                          onChanged: (v) =>
                              _onFieldChanged(_emailController, v),
                          keyboardType: TextInputType.emailAddress,
                          enabled: !_loading && invite?.emailLocked != true,
                        ),
                        const SizedBox(height: 12),
                        GlassInput(
                          label: invite?.phoneLocked == true
                              ? 'Telefone do convite'
                              : 'Telefone',
                          value: _phoneController.text,
                          onChanged: (v) =>
                              _onFieldChanged(_phoneController, v),
                          keyboardType: TextInputType.phone,
                          enabled: !_loading && invite?.phoneLocked != true,
                        ),
                        const SizedBox(height: 12),
                        GlassInput(
                          label: 'Usuário',
                          value: _usernameController.text,
                          onChanged: (v) =>
                              _onFieldChanged(_usernameController, v),
                          enabled: !_loading,
                        ),
                        const SizedBox(height: 12),
                        GlassInput(
                          label: 'Senha',
                          value: _passwordController.text,
                          onChanged: (v) =>
                              _onFieldChanged(_passwordController, v),
                          obscureText: true,
                          enabled: !_loading,
                        ),
                        const SizedBox(height: 12),
                        GlassInput(
                          label: 'Confirmar senha',
                          value: _confirmPasswordController.text,
                          onChanged: (v) =>
                              _onFieldChanged(_confirmPasswordController, v),
                          obscureText: true,
                          enabled: !_loading,
                        ),
                      ],
                      if (_error != null) ...[
                        const SizedBox(height: 12),
                        Text(
                          _error!,
                          style: const TextStyle(
                            color: Color(0xFFFECACA),
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                      const SizedBox(height: 28),
                      PrimaryButton(
                        label: _onFormStep
                            ? 'Confirmar e criar conta'
                            : 'Continuar',
                        loading: _loading,
                        disabled:
                            _loading ||
                            (!_onFormStep &&
                                _tokenController.text.trim().isEmpty),
                        trailingIcon: Icons.arrow_forward,
                        onPressed: _onFormStep
                            ? _submitRegistration
                            : _validateToken,
                      ),
                      const SizedBox(height: 20),
                      Center(
                        child: TextButton(
                          onPressed: widget.onBackToLogin,
                          child: Text(
                            'Já tem conta? Entrar',
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.85),
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _BirthDateField extends StatelessWidget {
  const _BirthDateField({
    required this.value,
    required this.enabled,
    required this.onTap,
  });

  final DateTime? value;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final label = value == null
        ? 'Selecionar data'
        : '${value!.day.toString().padLeft(2, '0')}/'
              '${value!.month.toString().padLeft(2, '0')}/'
              '${value!.year}';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Data de nascimento',
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.75),
            fontSize: 13,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 8),
        Opacity(
          opacity: enabled ? 1 : 0.5,
          child: Material(
            color: Colors.white.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(14),
            child: InkWell(
              onTap: enabled ? onTap : null,
              borderRadius: BorderRadius.circular(14),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 16,
                ),
                child: Text(
                  label,
                  style: TextStyle(
                    color: value == null
                        ? Colors.white.withValues(alpha: 0.45)
                        : Colors.white,
                    fontSize: 16,
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
