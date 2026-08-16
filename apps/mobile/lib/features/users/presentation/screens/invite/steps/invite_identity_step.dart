import 'package:atlasmed_mobile_app/core/user/models/user.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/assignment_option.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/invite_vertical_assignment.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/screens/invite/steps/invite_shared_widgets.dart';
import 'package:atlasmed_mobile_app/features/users/utils/date_format.dart';
import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

class InviteIdentityStep extends StatelessWidget {
  const InviteIdentityStep({
    super.key,
    required this.title,
    required this.description,
    required this.formKey,
    required this.firstNameController,
    required this.lastNameController,
    required this.emailController,
    required this.phoneController,
    required this.birthDate,
    required this.selectedRole,
    required this.roles,
    required this.rolesLoading,
    required this.rolesError,
    required this.onPickBirthDate,
    required this.onSelectRole,
    required this.sectors,
    required this.sectorsLoading,
    required this.sectorsError,
    required this.verticalAssignments,
    required this.onToggleSector,
  });

  final String title;
  final String description;
  final GlobalKey<FormState> formKey;
  final TextEditingController firstNameController;
  final TextEditingController lastNameController;
  final TextEditingController emailController;
  final TextEditingController phoneController;
  final DateTime? birthDate;
  final UserRole? selectedRole;
  final List<UserRole> roles;
  final bool rolesLoading;
  final bool rolesError;
  final VoidCallback onPickBirthDate;
  final ValueChanged<UserRole> onSelectRole;
  final List<VerticalOption> sectors;
  final bool sectorsLoading;
  final bool sectorsError;
  final Map<int, InviteVerticalAssignment> verticalAssignments;
  final void Function(VerticalOption sector, bool selected) onToggleSector;

  bool get _showVerticals =>
      selectedRole != null && selectedRole!.name != UserRoleName.admin;

  @override
  Widget build(BuildContext context) {
    return Form(
      key: formKey,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        children: [
          InviteStepHeader(title: title, description: description),
          InviteStepCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const InviteFieldLabel('Nome'),
                const SizedBox(height: 6),
                TextFormField(
                  controller: firstNameController,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(
                    // An example, like the e-mail and phone fields below.
                    // Repeating the label above it said nothing.
                    hintText: 'Adriana',
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
                const InviteFieldLabel('Sobrenome'),
                const SizedBox(height: 6),
                TextFormField(
                  controller: lastNameController,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(
                    hintText: 'Oliveira',
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
                const InviteFieldLabel('Data de nascimento'),
                const SizedBox(height: 6),
                OutlinedButton(
                  onPressed: onPickBirthDate,
                  style: OutlinedButton.styleFrom(
                    alignment: Alignment.centerLeft,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 14,
                    ),
                  ),
                  child: Text(
                    birthDate == null
                        ? 'Selecionar data'
                        : formatDate(birthDate!),
                    style: TextStyle(
                      color: birthDate == null
                          ? AppColors.gray400
                          : AppColors.gray900,
                    ),
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'O convidado precisará confirmar esta data no cadastro.',
                  style: TextStyle(fontSize: 12, color: AppColors.gray500),
                ),
                const SizedBox(height: 16),
                // "E-mail" — the spelling everywhere else in the app.
                const InviteFieldLabel('E-mail'),
                const SizedBox(height: 6),
                TextFormField(
                  controller: emailController,
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
                const SizedBox(height: 16),
                const InviteFieldLabel('Telefone'),
                const SizedBox(height: 6),
                TextFormField(
                  controller: phoneController,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(
                    hintText: '+55 11 99999-0000',
                    isDense: true,
                  ),
                  validator: (value) {
                    if (value == null || value.trim().isEmpty) {
                      return 'Informe o telefone.';
                    }
                    final digits = value.replaceAll(RegExp(r'\D'), '');
                    if (digits.length < 10) {
                      return 'Telefone inválido.';
                    }
                    return null;
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          InviteStepCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const InviteFieldLabel('Função'),
                const SizedBox(height: 10),
                if (rolesLoading)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 12),
                    child: Center(child: CircularProgressIndicator()),
                  )
                else if (rolesError)
                  const Text(
                    'Não foi possível carregar as funções.',
                    style: TextStyle(color: AppColors.gray500),
                  )
                else
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: roles.map((role) {
                      final selected = selectedRole?.id == role.id;
                      return GestureDetector(
                        onTap: () => onSelectRole(role),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 180),
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
                                  : AppColors.gray200,
                            ),
                          ),
                          child: Text(
                            role.name.label,
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: selected
                                  ? role.name.color
                                  : AppColors.gray700,
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
              ],
            ),
          ),
          if (_showVerticals) ...[
            const SizedBox(height: 16),
            InviteStepCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const InviteFieldLabel('Linhas comerciais'),
                  const SizedBox(height: 10),
                  if (sectorsLoading)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 12),
                      child: Center(child: CircularProgressIndicator()),
                    )
                  else if (sectorsError)
                    const Text(
                      'Não foi possível carregar as linhas comerciais.',
                      style: TextStyle(color: AppColors.gray500),
                    )
                  else
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: sectors.map((sector) {
                        final selected = verticalAssignments.containsKey(
                          sector.id,
                        );
                        return FilterChip(
                          label: Text(sector.name),
                          selected: selected,
                          onSelected: (value) => onToggleSector(sector, value),
                          selectedColor: const Color(
                            0xFF0a2f7f,
                          ).withValues(alpha: 0.12),
                          checkmarkColor: AppColors.navyDeep,
                          labelStyle: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: selected
                                ? AppColors.navyDeep
                                : AppColors.gray700,
                          ),
                          side: BorderSide(
                            color: selected
                                ? AppColors.navyDeep
                                : AppColors.gray200,
                          ),
                          backgroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(999),
                          ),
                        );
                      }).toList(),
                    ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
