import 'package:atlasmed_mobile_app/features/users/presentation/widgets/confirm_revoke_dialog.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/invite_vertical_assignment.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/user_assignments.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/user_invitation.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/providers/users_providers.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/widgets/territory_map_card.dart';
import 'package:atlasmed_mobile_app/features/users/utils/date_format.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:atlasmed_mobile_app/router/routes.dart';

/// Read-only review of a sent invite. Pending invites can open the edit form.
class InvitationDetailScreen extends ConsumerWidget {
  const InvitationDetailScreen({super.key, required this.invitationId});

  final int invitationId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final invitationAsync = ref.watch(invitationDetailProvider(invitationId));

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(6, 4, 10, 4),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => context.pop(),
                    icon: const Icon(
                      Icons.arrow_back_rounded,
                      color: AppColors.gray900,
                    ),
                  ),
                  const Expanded(
                    child: Text(
                      'Detalhes do convite',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: AppColors.gray900,
                      ),
                    ),
                  ),
                  invitationAsync.maybeWhen(
                    data: (invitation) => invitation.status.isEditable
                        ? PopupMenuButton<String>(
                            icon: const Icon(
                              Icons.more_vert_rounded,
                              color: AppColors.gray500,
                            ),
                            onSelected: (action) =>
                                _handleAction(context, ref, invitation, action),
                            itemBuilder: (context) => const [
                              PopupMenuItem(
                                value: 'resend',
                                child: Text('Reenviar'),
                              ),
                              PopupMenuItem(
                                value: 'revoke',
                                child: Text('Revogar'),
                              ),
                            ],
                          )
                        : const SizedBox.shrink(),
                    orElse: () => const SizedBox.shrink(),
                  ),
                ],
              ),
            ),
            Expanded(
              child: invitationAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (_, _) => const Center(
                  child: Text(
                    'Não foi possível carregar o convite.',
                    style: TextStyle(color: AppColors.gray500),
                  ),
                ),
                data: (invitation) => _InvitationDetailBody(
                  invitation: invitation,
                  onEdit: () => InvitationEditRoute(
                    invitationId: invitation.id,
                  ).push(context),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _handleAction(
    BuildContext context,
    WidgetRef ref,
    UserInvitation invitation,
    String action,
  ) async {
    if (action == 'revoke') {
      final confirmed = await confirmRevokeInvitation(
        context,
        inviteeName: invitation.displayName,
      );
      if (!confirmed || !context.mounted) return;
    }

    final repository = ref.read(invitationsRepositoryProvider);
    try {
      if (action == 'resend') {
        await repository.resendInvitation(invitation.id);
      } else if (action == 'revoke') {
        await repository.revokeInvitation(invitation.id);
      }
      ref.invalidate(invitationsListProvider);
      ref.invalidate(invitationDetailProvider(invitation.id));
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            action == 'resend' ? 'Convite reenviado.' : 'Convite revogado.',
          ),
        ),
      );
      if (action == 'revoke' && context.mounted) {
        context.pop();
      }
    } catch (_) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Não foi possível concluir a ação.')),
      );
    }
  }
}

class _InvitationDetailBody extends StatelessWidget {
  const _InvitationDetailBody({required this.invitation, required this.onEdit});

  final UserInvitation invitation;
  final VoidCallback onEdit;

  bool get _isRep => invitation.roleName.toUpperCase() == 'REP';
  bool get _isManager => invitation.roleName.toUpperCase() == 'MANAGER';
  bool get _showsAssignments => _isRep || _isManager;

  String get _roleLabel {
    final match = UserRoleName.values.where(
      (r) => r.name.toUpperCase() == invitation.roleName.toUpperCase(),
    );
    return match.isEmpty ? invitation.roleName : match.first.label;
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            children: [
              _IdentityCard(invitation: invitation, roleLabel: _roleLabel),
              const SizedBox(height: 12),
              _MetaCard(invitation: invitation),
              if (_showsAssignments) ...[
                const SizedBox(height: 12),
                if (invitation.verticalAssignments.isEmpty)
                  const _SectionCard(
                    title: 'Atribuições',
                    child: Text(
                      'Nenhuma linha comercial neste convite.',
                      style: TextStyle(
                        fontSize: 13.5,
                        color: AppColors.gray500,
                      ),
                    ),
                  )
                else
                  for (final assignment in invitation.verticalAssignments) ...[
                    _VerticalAssignmentCard(
                      assignment: assignment,
                      showManager: _isRep,
                    ),
                    const SizedBox(height: 12),
                  ],
              ],
            ],
          ),
        ),
        if (invitation.status.isEditable)
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.navyDeep,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  onPressed: onEdit,
                  icon: const Icon(Icons.edit_outlined, size: 18),
                  label: const Text('Editar convite'),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _IdentityCard extends StatelessWidget {
  const _IdentityCard({required this.invitation, required this.roleLabel});

  final UserInvitation invitation;
  final String roleLabel;

  @override
  Widget build(BuildContext context) {
    return _SectionCard(
      title: invitation.displayName,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppColors.navyDeep.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  roleLabel,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: AppColors.navyDeep,
                  ),
                ),
              ),
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: invitation.status.color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  invitation.status.label,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: invitation.status.color,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          _InfoRow(label: 'Email', value: invitation.email),
          _InfoRow(
            label: 'Telefone',
            value: invitation.phoneNumber?.isNotEmpty == true
                ? invitation.phoneNumber!
                : '—',
          ),
          _InfoRow(
            label: 'Data de nascimento',
            value: invitation.birthDate != null
                ? formatDate(invitation.birthDate!)
                : '—',
          ),
        ],
      ),
    );
  }
}

class _MetaCard extends StatelessWidget {
  const _MetaCard({required this.invitation});

  final UserInvitation invitation;

  @override
  Widget build(BuildContext context) {
    return _SectionCard(
      title: 'Envio',
      child: Column(
        children: [
          _InfoRow(label: 'Convidado por', value: invitation.invitedByName),
          _InfoRow(
            label: 'Enviado em',
            value: formatDate(invitation.createdAt),
          ),
          _InfoRow(label: 'Expira em', value: formatDate(invitation.expiresAt)),
          _InfoRow(label: 'Reenvios', value: '${invitation.resendCount}'),
        ],
      ),
    );
  }
}

class _VerticalAssignmentCard extends StatelessWidget {
  const _VerticalAssignmentCard({
    required this.assignment,
    required this.showManager,
  });

  final InviteVerticalAssignment assignment;
  final bool showManager;

  @override
  Widget build(BuildContext context) {
    return _SectionCard(
      title: assignment.verticalName,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (showManager) ...[
            _InfoRow(
              label: assignment.managers.length > 1 ? 'Gerentes' : 'Gerente',
              value:
                  assignment.managerName ?? assignment.managerZoneName ?? '—',
            ),
            if (assignment.managerZoneName != null) ...[
              const SizedBox(height: 8),
              _InfoRow(label: 'Zona', value: assignment.managerZoneName!),
            ],
            const SizedBox(height: 8),
          ],
          const Text(
            'Territórios',
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
              color: AppColors.gray500,
            ),
          ),
          const SizedBox(height: 8),
          if (assignment.territories.isEmpty)
            const Text(
              'Nenhum território selecionado.',
              style: TextStyle(fontSize: 13.5, color: AppColors.gray500),
            )
          else
            SizedBox(
              height: 176,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                physics: const BouncingScrollPhysics(),
                itemCount: assignment.territories.length,
                separatorBuilder: (_, _) => const SizedBox(width: 10),
                itemBuilder: (context, index) {
                  final territory = assignment.territories[index];
                  return TerritoryMapCard(
                    assignment: TerritoryAssignment(
                      territoryId: territory.id,
                      territoryName: territory.name,
                      assignedAt: DateTime.now(),
                      verticalId: territory.verticalId,
                      verticalName: territory.verticalName,
                      centroid: territory.centroid,
                      boundary: territory.boundary,
                    ),
                    width: 220,
                    mapHeight: 120,
                  );
                },
              ),
            ),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.surfaceSecondary),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: AppColors.gray900,
            ),
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: AppColors.gray500,
              ),
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
