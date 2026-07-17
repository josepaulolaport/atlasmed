import 'package:atlasmed_mobile_app/core/user/models/user.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/providers/users_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class InviteUserScreen extends ConsumerStatefulWidget {
  const InviteUserScreen({super.key});

  @override
  ConsumerState<InviteUserScreen> createState() => _InviteUserScreenState();
}

class _InviteUserScreenState extends ConsumerState<InviteUserScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();

  UserRole? _selectedRole;
  String? _managerId;
  String? _territoryId;
  bool _submitting = false;

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final rolesAsync = ref.watch(rolesProvider);
    final managersAsync = ref.watch(managerOptionsProvider);
    final territoriesAsync = ref.watch(territoryOptionsProvider);

    final needsManager = _selectedRole?.name == UserRoleName.rep;
    final needsTerritory =
        _selectedRole?.name == UserRoleName.rep ||
        _selectedRole?.name == UserRoleName.manager;

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(6, 4, 10, 4),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => context.pop(),
                    icon: const Icon(
                      Icons.arrow_back_rounded,
                      color: Color(0xFF0f1729),
                    ),
                  ),
                  const Text(
                    'Convidar usuário',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0f1729),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: Form(
                key: _formKey,
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                  children: [
                    const Text(
                      'Email',
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF6b7280),
                      ),
                    ),
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
                          return 'Informe um email.';
                        }
                        if (!value.contains('@')) return 'Email inválido.';
                        return null;
                      },
                    ),
                    const SizedBox(height: 20),
                    const Text(
                      'Função',
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF6b7280),
                      ),
                    ),
                    const SizedBox(height: 8),
                    rolesAsync.when(
                      loading: () => const Padding(
                        padding: EdgeInsets.symmetric(vertical: 12),
                        child: Center(child: CircularProgressIndicator()),
                      ),
                      error: (_, _) => const Text(
                        'Não foi possível carregar as funções.',
                        style: TextStyle(color: Color(0xFF6b7280)),
                      ),
                      data: (roles) => Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: roles.map((role) {
                          final selected = _selectedRole?.id == role.id;
                          return GestureDetector(
                            onTap: () => setState(() {
                              _selectedRole = role;
                              _managerId = null;
                              _territoryId = null;
                            }),
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 14,
                                vertical: 9,
                              ),
                              decoration: BoxDecoration(
                                color: selected
                                    ? role.name.color.withValues(alpha: 0.12)
                                    : Colors.white,
                                borderRadius: BorderRadius.circular(999),
                                border: Border.all(
                                  color: selected
                                      ? role.name.color
                                      : const Color(0xFFe5e7eb),
                                ),
                              ),
                              child: Text(
                                role.name.label,
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: selected
                                      ? role.name.color
                                      : const Color(0xFF374151),
                                ),
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                    if (needsManager) ...[
                      const SizedBox(height: 20),
                      const Text(
                        'Gerente responsável',
                        style: TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF6b7280),
                        ),
                      ),
                      const SizedBox(height: 8),
                      managersAsync.when(
                        loading: () => const CircularProgressIndicator(),
                        error: (_, _) => const Text(
                          'Não foi possível carregar os gerentes.',
                        ),
                        data: (managers) => DropdownButtonFormField<String>(
                          initialValue: _managerId,
                          decoration: const InputDecoration(
                            isDense: true,
                            hintText: 'Selecionar gerente',
                          ),
                          items: managers
                              .map(
                                (m) => DropdownMenuItem(
                                  value: m.id,
                                  child: Text(m.name),
                                ),
                              )
                              .toList(),
                          onChanged: (v) => setState(() => _managerId = v),
                        ),
                      ),
                    ],
                    if (needsTerritory) ...[
                      const SizedBox(height: 20),
                      const Text(
                        'Território',
                        style: TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF6b7280),
                        ),
                      ),
                      const SizedBox(height: 8),
                      territoriesAsync.when(
                        loading: () => const CircularProgressIndicator(),
                        error: (_, _) => const Text(
                          'Não foi possível carregar os territórios.',
                        ),
                        data: (territories) => DropdownButtonFormField<String>(
                          initialValue: _territoryId,
                          decoration: const InputDecoration(
                            isDense: true,
                            hintText: 'Selecionar território',
                          ),
                          items: territories
                              .map(
                                (t) => DropdownMenuItem(
                                  value: t.id,
                                  child: Text(t.name),
                                ),
                              )
                              .toList(),
                          onChanged: (v) => setState(() => _territoryId = v),
                        ),
                      ),
                    ],
                    const SizedBox(height: 28),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFF0a2f7f),
                          padding: const EdgeInsets.symmetric(vertical: 14),
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
                            : const Text('Enviar convite'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _submit() async {
    if (_selectedRole == null) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Selecione uma função.')));
      return;
    }
    if (!(_formKey.currentState?.validate() ?? false)) return;

    setState(() => _submitting = true);
    try {
      final role = _selectedRole!;
      await ref
          .read(invitationsRepositoryProvider)
          .createInvitation(
            email: _emailController.text.trim(),
            roleId: role.id,
            managerId: role.name == UserRoleName.rep ? _managerId : null,
            managerTerritoryId: role.name == UserRoleName.manager
                ? _territoryId
                : null,
            repTerritoryId: role.name == UserRoleName.rep ? _territoryId : null,
          );
      ref.invalidate(invitationsListProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Convite enviado com sucesso.')),
        );
        context.pop();
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Não foi possível enviar o convite.')),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }
}
