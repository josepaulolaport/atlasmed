import 'package:atlasmed_mobile_app/features/users/data/repositories/users_api_exception.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/providers/users_providers.dart';
import 'package:atlasmed_mobile_app/features/users/utils/date_format.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Form to edit a user's profile fields (name, email, phone, username,
/// birth date). Opened from the user detail screen.
class EditUserProfileScreen extends ConsumerStatefulWidget {
  const EditUserProfileScreen({super.key, required this.userId});

  final int userId;

  @override
  ConsumerState<EditUserProfileScreen> createState() =>
      _EditUserProfileScreenState();
}

class _EditUserProfileScreenState extends ConsumerState<EditUserProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _usernameController = TextEditingController();

  DateTime? _birthDate;
  bool _submitting = false;
  bool _hydrated = false;

  /// What was loaded, so back can tell an edited form from an untouched one.
  String? _initialSignature;

  String get _signature => [
    _firstNameController.text.trim(),
    _lastNameController.text.trim(),
    _emailController.text.trim(),
    _phoneController.text.trim(),
    _usernameController.text.trim(),
    _birthDate?.toIso8601String() ?? '',
  ].join('|');

  bool get _isDirty =>
      _initialSignature != null && _signature != _initialSignature;

  /// Back threw the whole form away without a word. Six fields in, that is a
  /// real loss, and nothing on screen warned it was coming.
  Future<void> _handleBack() async {
    if (!_isDirty) {
      context.pop();
      return;
    }
    final discard = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Descartar alterações?'),
        content: const Text('As informações que você mudou não foram salvas.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Continuar editando'),
          ),
          TextButton(
            key: const Key('edit-profile-discard'),
            onPressed: () => Navigator.of(dialogContext).pop(true),
            style: TextButton.styleFrom(foregroundColor: AppColors.red),
            child: const Text('Descartar'),
          ),
        ],
      ),
    );
    if (discard == true && mounted) {
      context.pop();
    }
  }

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _usernameController.dispose();
    super.dispose();
  }

  void _hydrateFromUser() {
    if (_hydrated) return;
    final user = ref.read(userDetailProvider(widget.userId)).valueOrNull;
    if (user == null) return;
    _firstNameController.text = user.firstName ?? '';
    _lastNameController.text = user.lastName ?? '';
    _emailController.text = user.email;
    _phoneController.text = user.phoneNumber ?? '';
    _usernameController.text = user.username;
    _birthDate = user.birthDate;
    _hydrated = true;
    _initialSignature = _signature;
  }

  @override
  Widget build(BuildContext context) {
    final canAdmin = ref.watch(canManageUserAdminProvider);
    if (!canAdmin) {
      return Scaffold(
        backgroundColor: Colors.white,
        body: SafeArea(
          child: Column(
            children: [
              Align(
                alignment: Alignment.centerLeft,
                child: IconButton(
                  onPressed: () => context.pop(),
                  icon: const Icon(Icons.arrow_back_rounded),
                ),
              ),
              const Expanded(
                child: Center(
                  child: Text(
                    'Acesso restrito.',
                    style: TextStyle(color: AppColors.gray500),
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    final userAsync = ref.watch(userDetailProvider(widget.userId));

    // canPop stays false because the form's dirtiness changes on every
    // keystroke, and typing in a TextFormField does not rebuild this widget —
    // a computed canPop would be stale exactly when it mattered. _handleBack
    // pops straight through when nothing was touched.
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _handleBack();
      },
      child: Scaffold(
        backgroundColor: Colors.white,
        body: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(6, 4, 10, 4),
                child: Row(
                  children: [
                    IconButton(
                      onPressed: _handleBack,
                      icon: const Icon(
                        Icons.arrow_back_rounded,
                        color: AppColors.gray900,
                      ),
                    ),
                    const Expanded(
                      child: Text(
                        'Editar informações',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: AppColors.gray900,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: userAsync.when(
                  loading: () =>
                      const Center(child: CircularProgressIndicator()),
                  error: (_, _) => const Center(
                    child: Text(
                      'Não foi possível carregar o usuário.',
                      style: TextStyle(color: AppColors.gray500),
                    ),
                  ),
                  data: (user) {
                    if (user == null) {
                      return const Center(
                        child: Text(
                          'Usuário não encontrado.',
                          style: TextStyle(color: AppColors.gray500),
                        ),
                      );
                    }
                    if (!_hydrated) {
                      WidgetsBinding.instance.addPostFrameCallback((_) {
                        if (!mounted) return;
                        setState(_hydrateFromUser);
                      });
                    }
                    return Form(
                      key: _formKey,
                      child: ListView(
                        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                        children: [
                          _label('Nome'),
                          const SizedBox(height: 6),
                          TextFormField(
                            controller: _firstNameController,
                            textCapitalization: TextCapitalization.words,
                            decoration: const InputDecoration(
                              hintText: 'Nome',
                              isDense: true,
                            ),
                            validator: (value) {
                              if (value == null || value.trim().isEmpty) {
                                return 'Informe o nome.';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 16),
                          _label('Sobrenome'),
                          const SizedBox(height: 6),
                          TextFormField(
                            controller: _lastNameController,
                            textCapitalization: TextCapitalization.words,
                            decoration: const InputDecoration(
                              hintText: 'Sobrenome',
                              isDense: true,
                            ),
                            validator: (value) {
                              if (value == null || value.trim().isEmpty) {
                                return 'Informe o sobrenome.';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 16),
                          _label('E-mail'),
                          const SizedBox(height: 6),
                          TextFormField(
                            controller: _emailController,
                            keyboardType: TextInputType.emailAddress,
                            decoration: const InputDecoration(
                              hintText: 'nome@empresa.com.br',
                              isDense: true,
                            ),
                            validator: (value) {
                              if (value == null || value.trim().isEmpty) {
                                return 'Informe um e-mail.';
                              }
                              if (!value.contains('@')) {
                                return 'E-mail inválido.';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 16),
                          _label('Telefone'),
                          const SizedBox(height: 6),
                          TextFormField(
                            controller: _phoneController,
                            keyboardType: TextInputType.phone,
                            decoration: const InputDecoration(
                              hintText: '+55 11 99999-0000',
                              isDense: true,
                            ),
                            validator: (value) {
                              if (value == null || value.trim().isEmpty) {
                                return 'Informe o telefone.';
                              }
                              final digits = value.replaceAll(
                                RegExp(r'\D'),
                                '',
                              );
                              if (digits.length < 10) {
                                return 'Telefone inválido.';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 16),
                          _label('Usuário'),
                          const SizedBox(height: 6),
                          TextFormField(
                            controller: _usernameController,
                            decoration: const InputDecoration(
                              hintText: 'usuario.sobrenome',
                              isDense: true,
                              prefixText: '@',
                            ),
                            validator: (value) {
                              if (value == null || value.trim().isEmpty) {
                                return 'Informe o nome de usuário.';
                              }
                              if (value.contains(' ')) {
                                return 'Sem espaços.';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 16),
                          _label('Data de nascimento'),
                          const SizedBox(height: 6),
                          OutlinedButton(
                            onPressed: _pickBirthDate,
                            style: OutlinedButton.styleFrom(
                              alignment: Alignment.centerLeft,
                              padding: const EdgeInsets.symmetric(
                                horizontal: 14,
                                vertical: 14,
                              ),
                            ),
                            child: Text(
                              _birthDate == null
                                  ? 'Selecionar data'
                                  : formatDate(_birthDate!),
                              style: TextStyle(
                                color: _birthDate == null
                                    ? AppColors.gray400
                                    : AppColors.gray900,
                              ),
                            ),
                          ),
                          const SizedBox(height: 28),
                          SizedBox(
                            width: double.infinity,
                            child: FilledButton(
                              style: FilledButton.styleFrom(
                                backgroundColor: AppColors.navyDeep,
                                padding: const EdgeInsets.symmetric(
                                  vertical: 14,
                                ),
                              ),
                              onPressed: _submitting ? null : _submit,
                              child: _submitting
                                  ? const SizedBox(
                                      width: 18,
                                      height: 18,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: Colors.white,
                                      ),
                                    )
                                  : const Text('Salvar alterações'),
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
    );
  }

  Future<void> _pickBirthDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _birthDate ?? DateTime(now.year - 30),
      firstDate: DateTime(1940),
      lastDate: now,
    );
    if (picked != null && mounted) {
      setState(() => _birthDate = picked);
    }
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _submitting = true);
    try {
      await ref
          .read(usersRepositoryProvider)
          .updateUserProfile(
            userId: widget.userId,
            firstName: _firstNameController.text.trim(),
            lastName: _lastNameController.text.trim(),
            email: _emailController.text.trim(),
            phoneNumber: _phoneController.text.trim(),
            username: _usernameController.text.trim(),
            birthDate: _birthDate,
          );
      ref.invalidate(userDetailProvider(widget.userId));
      await ref.read(usersListProvider.notifier).refreshRow(widget.userId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Informações atualizadas.')),
        );
        context.pop();
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(_describeSaveError(error))));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  /// The two ways this realistically fails are a taken email and a taken
  /// username, and both are fixable — but every failure said the same
  /// "Não foi possível salvar as informações.", which points at no field.
  String _describeSaveError(Object error) {
    if (error is! UsersApiException) {
      return 'Não foi possível salvar as informações.';
    }
    if (error.statusCode == 409 || error.code == 'EMAIL_ALREADY_EXISTS') {
      final message = error.message.toLowerCase();
      if (message.contains('username') || message.contains('usuário')) {
        return 'Este nome de usuário já está em uso.';
      }
      return 'Este email já pertence a outra pessoa.';
    }
    if (error.statusCode == 403) {
      return 'Você não pode editar este usuário.';
    }
    return 'Não foi possível salvar as informações.';
  }

  Widget _label(String text) => Text(
    text,
    style: const TextStyle(
      fontSize: 12.5,
      fontWeight: FontWeight.w600,
      color: AppColors.gray500,
    ),
  );
}
