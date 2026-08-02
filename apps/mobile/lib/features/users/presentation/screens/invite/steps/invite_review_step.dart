import 'package:atlasmed_mobile_app/core/user/models/user.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/invite_vertical_assignment.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/screens/invite/steps/invite_shared_widgets.dart';
import 'package:atlasmed_mobile_app/features/users/utils/date_format.dart';
import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

class InviteReviewStep extends StatelessWidget {
  const InviteReviewStep({
    super.key,
    required this.title,
    required this.description,
    required this.firstName,
    required this.lastName,
    required this.email,
    required this.phone,
    required this.birthDate,
    required this.role,
    required this.assignments,
  });

  final String title;
  final String description;
  final String firstName;
  final String lastName;
  final String email;
  final String phone;
  final DateTime birthDate;
  final UserRole role;
  final List<InviteVerticalAssignment> assignments;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
      children: [
        InviteStepHeader(title: title, description: description),
        InviteStepCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const InviteFieldLabel('Identidade'),
              const SizedBox(height: 12),
              _ReviewRow(label: 'Nome', value: '$firstName $lastName'),
              _ReviewRow(label: 'Nascimento', value: formatDate(birthDate)),
              _ReviewRow(label: 'Email', value: email),
              _ReviewRow(label: 'Telefone', value: phone, isLast: true),
            ],
          ),
        ),
        const SizedBox(height: 12),
        InviteStepCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const InviteFieldLabel('Função'),
              const SizedBox(height: 12),
              InviteContextChip(label: role.name.label, color: role.name.color),
            ],
          ),
        ),
        if (role.name != UserRoleName.admin) ...[
          const SizedBox(height: 12),
          InviteStepCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const InviteFieldLabel('Atribuições'),
                const SizedBox(height: 12),
                if (assignments.isEmpty)
                  const Text(
                    'Nenhuma linha comercial selecionada.',
                    style: TextStyle(color: AppColors.gray500),
                  )
                else
                  ...assignments.map(
                    (a) => Padding(
                      padding: const EdgeInsets.only(bottom: 14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            a.verticalName,
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: AppColors.gray900,
                            ),
                          ),
                          if (a.managerZoneName != null) ...[
                            const SizedBox(height: 4),
                            Text(
                              'Zona: ${a.managerZoneName}',
                              style: const TextStyle(
                                fontSize: 13,
                                color: AppColors.gray600,
                              ),
                            ),
                          ],
                          const SizedBox(height: 4),
                          Text(
                            _territorySummary(a),
                            style: const TextStyle(
                              fontSize: 13,
                              color: AppColors.gray600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ],
    );
  }

  String _territorySummary(InviteVerticalAssignment a) {
    if (a.newPatch != null) {
      return 'Nova área (rascunho): ${a.newPatch!.name}';
    }
    if (a.territories.isEmpty) {
      return role.name == UserRoleName.ops
          ? 'Somente linha comercial'
          : 'Nenhum território';
    }
    if (a.territories.length == 1) {
      return a.territories.first.name;
    }
    return '${a.territories.length} territórios: '
        '${a.territories.map((t) => t.name).join(', ')}';
  }
}

class _ReviewRow extends StatelessWidget {
  const _ReviewRow({
    required this.label,
    required this.value,
    this.isLast = false,
  });

  final String label;
  final String value;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: isLast ? 0 : 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 96,
            child: Text(
              label,
              style: const TextStyle(fontSize: 13, color: AppColors.gray500),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w600,
                color: AppColors.gray900,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
