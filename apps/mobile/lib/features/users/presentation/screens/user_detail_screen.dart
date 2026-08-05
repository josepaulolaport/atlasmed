import 'package:atlasmed_mobile_app/core/user/models/user.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_status.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/assignment_option.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/invite_vertical_assignment.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/user_assignments.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/providers/users_providers.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/widgets/change_role_sheet.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/widgets/manage_permissions_sheet.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/widgets/territory_map_card.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/widgets/manager_empty_zones_picker_screen.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/widgets/rep_manager_zone_picker_screen.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/widgets/territory_picker_screen.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/widgets/user_avatar.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/widgets/user_badges.dart';

import 'package:atlasmed_mobile_app/features/users/utils/date_format.dart';
import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/shared/widgets/loading/atlas_shimmer.dart';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

class UserDetailScreen extends ConsumerWidget {
  const UserDetailScreen({super.key, required this.userId});

  final String userId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final capabilities = ref.watch(userCapabilitiesProvider);
    final canLifecycle = capabilities?.can(.lifecycle, .user) ?? false;
    final canAdmin = capabilities?.can(.manage, .user) ?? false;
    final userAsync = ref.watch(userDetailProvider(userId));

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            _Header(
              title: userAsync.valueOrNull?.displayName ?? 'Usuário',
              onMore: canLifecycle && userAsync.valueOrNull != null
                  ? () => _showLifecycleSheet(
                      context,
                      ref,
                      userAsync.value!,
                      canAdmin: canAdmin,
                    )
                  : null,
            ),
            Expanded(
              child: userAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (_, _) => const Center(
                  child: Text(
                    'Não foi possível carregar este usuário.',
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
                  return _UserDetailBody(user: user, canManageAdmin: canAdmin);
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showLifecycleSheet(
    BuildContext context,
    WidgetRef ref,
    User user, {
    required bool canAdmin,
  }) async {
    final action = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (canAdmin) ...[
              ListTile(
                leading: const Icon(Icons.badge_outlined),
                title: const Text('Alterar função'),
                onTap: () => Navigator.pop(sheetContext, 'role'),
              ),
              ListTile(
                leading: const Icon(Icons.security_outlined),
                title: const Text('Gerenciar permissões'),
                onTap: () => Navigator.pop(sheetContext, 'permissions'),
              ),
            ],
            if (user.status.name == 'inactive')
              ListTile(
                leading: const Icon(
                  Icons.play_circle_outline,
                  color: AppColors.green,
                ),
                title: const Text('Ativar'),
                onTap: () => Navigator.pop(sheetContext, 'activate'),
              ),
            if (user.status.name == 'active') ...[
              ListTile(
                leading: const Icon(
                  Icons.pause_circle_outline,
                  color: AppColors.amber,
                ),
                title: const Text('Suspender'),
                onTap: () => Navigator.pop(sheetContext, 'suspend'),
              ),
              ListTile(
                leading: const Icon(Icons.block_outlined, color: AppColors.red),
                title: const Text('Desativar'),
                onTap: () => Navigator.pop(sheetContext, 'deactivate'),
              ),
            ],
            if (user.status.name == 'suspended')
              ListTile(
                leading: const Icon(
                  Icons.play_circle_outline,
                  color: AppColors.green,
                ),
                title: const Text('Cancelar suspensão'),
                onTap: () => Navigator.pop(sheetContext, 'unsuspend'),
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );

    if (action == null || !context.mounted) return;

    if (action == 'role') {
      await ChangeRoleSheet.show(context, user: user);
      ref.invalidate(userDetailProvider(userId));
      await ref.read(usersListProvider.notifier).refreshRow(userId);
      return;
    }

    if (action == 'permissions') {
      try {
        final grants = await ref
            .read(usersRepositoryProvider)
            .getUserPermissions(userId);
        if (!context.mounted) return;
        await ManagePermissionsSheet.show(context, user: user, grants: grants);
      } catch (_) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Não foi possível carregar as permissões.'),
            ),
          );
        }
      }
      return;
    }

    final repository = ref.read(usersRepositoryProvider);
    final labels = {
      'activate': 'ativado',
      'deactivate': 'desativado',
      'suspend': 'suspenso',
      'unsuspend': 'reativado',
    };

    try {
      switch (action) {
        case 'activate':
          await repository.activateUser(userId);
        case 'deactivate':
          await repository.deactivateUser(userId);
        case 'suspend':
          await repository.suspendUser(userId);
        case 'unsuspend':
          await repository.unsuspendUser(userId);
      }
      ref.invalidate(userDetailProvider(userId));
      await ref.read(usersListProvider.notifier).refreshRow(userId);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Usuário ${labels[action]} com sucesso.')),
        );
      }
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Não foi possível concluir a ação.')),
        );
      }
    }
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.title, required this.onMore});

  final String title;
  final VoidCallback? onMore;

  @override
  Widget build(BuildContext context) {
    return Padding(
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
          Expanded(
            child: Text(
              title,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: AppColors.gray900,
              ),
            ),
          ),
          if (onMore != null)
            IconButton(
              onPressed: onMore,
              icon: const Icon(
                Icons.more_vert_rounded,
                color: AppColors.gray900,
              ),
            ),
        ],
      ),
    );
  }
}

class _UserDetailBody extends ConsumerWidget {
  const _UserDetailBody({required this.user, required this.canManageAdmin});

  final User user;
  final bool canManageAdmin;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final assignmentsAsync = ref.watch(userAssignmentsProvider(user.id));

    final showsAssignments =
        user.role.name == UserRoleName.rep ||
        user.role.name == UserRoleName.manager;

    return ListView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
      children: [
        _IdentityCard(user: user, canManageAdmin: canManageAdmin),
        if (showsAssignments) ...[
          const SizedBox(height: 16),
          assignmentsAsync.when(
            loading: () => const _SectionSkeleton(height: 220),
            error: (_, _) => const SizedBox.shrink(),
            data: (assignments) => _AssignmentsSection(
              user: user,
              assignments: assignments,
              canManage: canManageAdmin,
            ),
          ),
        ],
      ],
    );
  }
}

class _IdentityCard extends StatelessWidget {
  const _IdentityCard({required this.user, required this.canManageAdmin});

  final User user;
  final bool canManageAdmin;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.surfaceSecondary),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              UserAvatar(user: user, size: 56),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      user.displayName,
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.3,
                        color: AppColors.gray900,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      user.email,
                      style: const TextStyle(
                        fontSize: 12.5,
                        color: AppColors.gray500,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        RoleBadge(role: user.role.name),
                        StatusBadge(status: user.status),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (canManageAdmin) ...[
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () => context.push('/users/${user.id}/edit'),
                icon: const Icon(Icons.edit_outlined, size: 18),
                label: const Text('Editar informações'),
              ),
            ),
          ],
          const SizedBox(height: 16),
          const Divider(height: 1, color: AppColors.gray100),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _VerificationChip(label: 'Email', verified: user.emailVerified),
              _VerificationChip(
                label: 'Telefone',
                verified: user.phoneVerified,
              ),
              _VerificationChip(label: '2FA', verified: user.twoFactorEnabled),
            ],
          ),
          const SizedBox(height: 14),
          const Divider(height: 1, color: AppColors.gray100),
          const SizedBox(height: 12),
          _DetailRow(label: 'Usuário', value: '@${user.username}'),
          const SizedBox(height: 8),
          _DetailRow(
            label: 'Telefone',
            value: user.phoneNumber ?? 'Não informado',
          ),
          const SizedBox(height: 8),
          _DetailRow(
            label: 'Data de nascimento',
            value: user.birthDate != null
                ? formatDate(user.birthDate!)
                : 'Não informada',
          ),
          const SizedBox(height: 8),
          _DetailRow(label: 'Membro desde', value: formatDate(user.createdAt)),
          const SizedBox(height: 8),
          _DetailRow(
            label: 'Última atualização',
            value: formatDate(user.updatedAt),
          ),
          const SizedBox(height: 8),
          _DetailRow(
            label: 'Último acesso',
            value: user.lastLoginAt != null
                ? formatDateTime(user.lastLoginAt!)
                : 'Nunca acessou',
          ),
          if (user.status == UserStatus.suspended &&
              user.suspendedAt != null) ...[
            const SizedBox(height: 8),
            _DetailRow(
              label: 'Suspenso desde',
              value: formatDate(user.suspendedAt!),
            ),
          ],
          if (user.status == UserStatus.inactive &&
              user.deactivatedAt != null) ...[
            const SizedBox(height: 8),
            _DetailRow(
              label: 'Desativado desde',
              value: formatDate(user.deactivatedAt!),
            ),
          ],
        ],
      ),
    );
  }
}

class _VerificationChip extends StatelessWidget {
  const _VerificationChip({required this.label, required this.verified});

  final String label;
  final bool verified;

  @override
  Widget build(BuildContext context) {
    final color = verified ? AppColors.green : AppColors.gray400;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            verified ? Icons.check_circle_rounded : Icons.cancel_rounded,
            size: 12,
            color: color,
          ),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

class _AssignmentsSection extends ConsumerWidget {
  const _AssignmentsSection({
    required this.user,
    required this.assignments,
    required this.canManage,
  });

  final User user;
  final UserAssignments assignments;
  final bool canManage;

  bool get _showManager => user.role.name == UserRoleName.rep;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final verticalAssignments = assignments.verticalAssignments;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionCard(
          title: 'Linhas comerciais',
          trailing: canManage
              ? TextButton(
                  onPressed: () async {
                    await context.push('/users/${user.id}/assignments');
                    ref.invalidate(userAssignmentsProvider(user.id));
                  },
                  child: const Text('Gerenciar'),
                )
              : null,
          child: verticalAssignments.isEmpty
              ? const Text(
                  'Nenhuma linha comercial atribuída.',
                  style: TextStyle(fontSize: 13, color: AppColors.gray400),
                )
              : Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: verticalAssignments
                      .map(
                        (a) => Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 5,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.gray100,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            a.verticalName,
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: AppColors.gray700,
                            ),
                          ),
                        ),
                      )
                      .toList(),
                ),
        ),
        for (final assignment in verticalAssignments) ...[
          const SizedBox(height: 12),
          _VerticalAssignmentCard(
            userId: user.id,
            assignment: assignment,
            allAssignments: assignments,
            showManager: _showManager,
            canManage: canManage,
          ),
        ],
      ],
    );
  }
}

class _VerticalAssignmentCard extends ConsumerStatefulWidget {
  const _VerticalAssignmentCard({
    required this.userId,
    required this.assignment,
    required this.allAssignments,
    required this.showManager,
    required this.canManage,
  });

  final String userId;
  final InviteVerticalAssignment assignment;
  final UserAssignments allAssignments;
  final bool showManager;
  final bool canManage;

  @override
  ConsumerState<_VerticalAssignmentCard> createState() =>
      _VerticalAssignmentCardState();
}

class _VerticalAssignmentCardState
    extends ConsumerState<_VerticalAssignmentCard> {
  bool _busy = false;

  InviteVerticalAssignment get assignment => widget.assignment;

  Future<void> _persist(InviteVerticalAssignment updated) async {
    setState(() => _busy = true);
    try {
      final next = widget.allAssignments.verticalAssignments
          .map((a) => a.verticalId == updated.verticalId ? updated : a)
          .toList();
      await ref
          .read(usersRepositoryProvider)
          .replaceVerticalAssignments(widget.userId, next);
      ref.invalidate(userAssignmentsProvider(widget.userId));
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Não foi possível atualizar a linha comercial.'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _pickZone() async {
    if (!widget.canManage || _busy) return;
    final zone = await RepManagerZonePickerScreen.pick(
      context,
      verticalId: assignment.verticalId,
      initiallySelectedId: assignment.managerZoneId,
    );
    if (zone == null || !mounted) return;
    final managerName = zone.assignedUserName?.trim().isNotEmpty == true
        ? zone.assignedUserName
        : await ref
              .read(usersRepositoryProvider)
              .getTerritoryAssigneeName(zone.id);
    if (!mounted) return;
    await _persist(
      assignment.copyWith(
        managerZoneId: zone.id,
        managerZoneName: zone.name,
        managerDisplayName: managerName,
        managers: managerName == null
            ? const []
            : [AssignmentManagerRef(id: zone.id, name: managerName)],
        territories: const [],
      ),
    );
  }

  Future<void> _clearZone() async {
    if (!widget.canManage || _busy) return;
    await _persist(assignment.copyWith(clearZone: true, territories: const []));
  }

  Future<void> _pickTerritories() async {
    if (!widget.canManage || _busy) return;
    final List<TerritoryOption>? picked;
    if (widget.showManager) {
      final zoneId = assignment.managerZoneId;
      if (zoneId == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Selecione a zona do gerente primeiro.'),
          ),
        );
        return;
      }
      picked = await TerritoryPickerScreen.pickForZone(
        context,
        managerZoneId: zoneId,
        verticalId: assignment.verticalId,
        initiallySelectedIds: assignment.territories.map((t) => t.id).toSet(),
      );
    } else {
      picked = await ManagerEmptyZonesPickerScreen.pick(
        context,
        verticalId: assignment.verticalId,
        initiallySelectedIds: assignment.territories.map((t) => t.id).toSet(),
      );
    }
    if (picked == null || !mounted) return;
    await _persist(assignment.copyWith(territories: picked));
  }

  Future<void> _removeTerritory(String territoryId) async {
    if (!widget.canManage || _busy) return;
    await _persist(
      assignment.copyWith(
        territories: assignment.territories
            .where((t) => t.id != territoryId)
            .toList(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final canManage = widget.canManage;

    return _SectionCard(
      title: assignment.verticalName,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_busy) const LinearProgressIndicator(minHeight: 2),
          if (_busy) const SizedBox(height: 10),
          if (widget.showManager) ...[
            const Text(
              'Zona do gerente',
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
                color: AppColors.gray500,
              ),
            ),
            const SizedBox(height: 8),
            if (canManage)
              Material(
                color: AppColors.background,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: const BorderSide(color: AppColors.gray200),
                ),
                child: InkWell(
                  onTap: _busy ? null : _pickZone,
                  borderRadius: BorderRadius.circular(12),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 12,
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.map_outlined,
                          size: 20,
                          color: AppColors.navyDeep,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            assignment.managerZoneName ??
                                assignment.managerDisplayName ??
                                'Selecionar zona',
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: AppColors.gray900,
                            ),
                          ),
                        ),
                        if (assignment.managerZoneId != null)
                          IconButton(
                            onPressed: _busy ? null : _clearZone,
                            visualDensity: VisualDensity.compact,
                            icon: const Icon(
                              Icons.close_rounded,
                              size: 18,
                              color: AppColors.gray400,
                            ),
                          )
                        else
                          const Icon(
                            Icons.chevron_right_rounded,
                            color: AppColors.gray400,
                          ),
                      ],
                    ),
                  ),
                ),
              )
            else ...[
              if (assignment.managers.length > 1) ...[
                const Text(
                  'Gerentes',
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                    color: AppColors.gray500,
                  ),
                ),
                const SizedBox(height: 6),
                ...assignment.managers.map(
                  (m) => Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Text(
                      m.name,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: AppColors.gray900,
                      ),
                    ),
                  ),
                ),
                if (assignment.managerZoneName != null) ...[
                  const SizedBox(height: 4),
                  _DetailRow(label: 'Zona', value: assignment.managerZoneName!),
                ],
              ] else
                _DetailRow(
                  label: 'Zona / gerente',
                  value:
                      assignment.managerName ??
                      assignment.managerZoneName ??
                      assignment.managerDisplayName ??
                      'Sem zona',
                ),
            ],
            const SizedBox(height: 12),
          ],
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Territórios',
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                    color: AppColors.gray500,
                  ),
                ),
              ),
              if (canManage)
                TextButton(
                  onPressed: _busy ? null : _pickTerritories,
                  child: Text(
                    assignment.territories.isEmpty ? 'Selecionar' : 'Editar',
                  ),
                ),
            ],
          ),
          if (assignment.territories.isEmpty)
            Text(
              canManage &&
                      widget.showManager &&
                      assignment.managerZoneId == null
                  ? 'Selecione a zona do gerente primeiro.'
                  : 'Nenhum território selecionado.',
              style: const TextStyle(fontSize: 13, color: AppColors.gray400),
            )
          else
            SizedBox(
              height: 176,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                physics: const BouncingScrollPhysics(),
                clipBehavior: Clip.none,
                itemCount: assignment.territories.length,
                separatorBuilder: (_, _) => const SizedBox(width: 10),
                itemBuilder: (context, index) {
                  final territory = assignment.territories[index];
                  return Stack(
                    children: [
                      TerritoryMapCard(
                        assignment: TerritoryAssignment.fromOption(territory),
                        width: 220,
                        mapHeight: 120,
                        onTap: canManage ? _pickTerritories : null,
                      ),
                      if (canManage)
                        Positioned(
                          top: 28,
                          right: 4,
                          child: Material(
                            color: Colors.white,
                            shape: const CircleBorder(),
                            elevation: 1,
                            child: InkWell(
                              customBorder: const CircleBorder(),
                              onTap: _busy
                                  ? null
                                  : () => _removeTerritory(territory.id),
                              child: const Padding(
                                padding: EdgeInsets.all(4),
                                child: Icon(
                                  Icons.close_rounded,
                                  size: 16,
                                  color: AppColors.gray500,
                                ),
                              ),
                            ),
                          ),
                        ),
                    ],
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
  const _SectionCard({required this.title, required this.child, this.trailing});

  final String title;
  final Widget child;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.surfaceSecondary),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  title,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w700,
                    color: AppColors.gray900,
                  ),
                ),
              ),
              ?trailing,
            ],
          ),
          const SizedBox(height: 10),
          child,
        ],
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 13.5, color: AppColors.gray500),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            value,
            textAlign: TextAlign.right,
            overflow: TextOverflow.ellipsis,
            maxLines: 1,
            style: const TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w600,
              color: AppColors.gray900,
            ),
          ),
        ),
      ],
    );
  }
}

class _SectionSkeleton extends StatelessWidget {
  const _SectionSkeleton({required this.height});

  final double height;

  @override
  Widget build(BuildContext context) {
    return AtlasShimmer(
      child: Container(
        height: height,
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: AppColors.surfaceSecondary),
          borderRadius: BorderRadius.circular(16),
        ),
      ),
    );
  }
}
