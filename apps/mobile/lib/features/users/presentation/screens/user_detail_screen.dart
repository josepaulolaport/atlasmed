import 'package:atlasmed_mobile_app/core/user/models/user.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_status.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/permission_grant.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/user_assignments.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/providers/users_providers.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/widgets/change_role_sheet.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/widgets/manage_assignments_sheet.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/widgets/manage_permissions_sheet.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/widgets/territory_map_card.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/widgets/user_avatar.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/widgets/user_badges.dart';
import 'package:atlasmed_mobile_app/features/users/utils/date_format.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class UserDetailScreen extends ConsumerWidget {
  const UserDetailScreen({super.key, required this.userId});

  final String userId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final canManage = ref.watch(canManageUsersProvider);
    final userAsync = ref.watch(userDetailProvider(userId));

    return Scaffold(
      backgroundColor: const Color(0xFFf7f8fb),
      body: SafeArea(
        child: Column(
          children: [
            _Header(
              title: userAsync.valueOrNull?.displayName ?? 'Usuário',
              onMore: canManage && userAsync.valueOrNull != null
                  ? () => _showLifecycleSheet(context, ref, userAsync.value!)
                  : null,
            ),
            Expanded(
              child: userAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (_, _) => const Center(
                  child: Text(
                    'Não foi possível carregar este usuário.',
                    style: TextStyle(color: Color(0xFF6b7280)),
                  ),
                ),
                data: (user) {
                  if (user == null) {
                    return const Center(
                      child: Text(
                        'Usuário não encontrado.',
                        style: TextStyle(color: Color(0xFF6b7280)),
                      ),
                    );
                  }
                  return _UserDetailBody(user: user, canManage: canManage);
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
    User user,
  ) async {
    final action = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.badge_outlined),
              title: const Text('Alterar função'),
              onTap: () => Navigator.pop(sheetContext, 'role'),
            ),
            if (user.status.name == 'inactive')
              ListTile(
                leading: const Icon(
                  Icons.play_circle_outline,
                  color: Color(0xFF16a373),
                ),
                title: const Text('Ativar'),
                onTap: () => Navigator.pop(sheetContext, 'activate'),
              ),
            if (user.status.name == 'active') ...[
              ListTile(
                leading: const Icon(
                  Icons.pause_circle_outline,
                  color: Color(0xFFc6861b),
                ),
                title: const Text('Suspender'),
                onTap: () => Navigator.pop(sheetContext, 'suspend'),
              ),
              ListTile(
                leading: const Icon(
                  Icons.block_outlined,
                  color: Color(0xFFb84545),
                ),
                title: const Text('Desativar'),
                onTap: () => Navigator.pop(sheetContext, 'deactivate'),
              ),
            ],
            if (user.status.name == 'suspended')
              ListTile(
                leading: const Icon(
                  Icons.play_circle_outline,
                  color: Color(0xFF16a373),
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
              color: Color(0xFF0f1729),
            ),
          ),
          Expanded(
            child: Text(
              title,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: Color(0xFF0f1729),
              ),
            ),
          ),
          if (onMore != null)
            IconButton(
              onPressed: onMore,
              icon: const Icon(
                Icons.more_vert_rounded,
                color: Color(0xFF0f1729),
              ),
            ),
        ],
      ),
    );
  }
}

class _UserDetailBody extends ConsumerWidget {
  const _UserDetailBody({required this.user, required this.canManage});

  final User user;
  final bool canManage;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final assignmentsAsync = ref.watch(userAssignmentsProvider(user.id));
    final permissionsAsync = ref.watch(userPermissionsProvider(user.id));

    return ListView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
      children: [
        _IdentityCard(user: user),
        const SizedBox(height: 16),
        assignmentsAsync.when(
          loading: () => const _SectionShimmer(height: 220),
          error: (_, _) => const SizedBox.shrink(),
          data: (assignments) => _AssignmentsSection(
            user: user,
            assignments: assignments,
            canManage: canManage,
          ),
        ),
        if (user.role.name == UserRoleName.rep ||
            user.role.name == UserRoleName.manager) ...[
          const SizedBox(height: 16),
          assignmentsAsync.when(
            loading: () => const _SectionShimmer(height: 176),
            error: (_, _) => const SizedBox.shrink(),
            data: (assignments) =>
                _TerritoryMapsSection(assignments: assignments),
          ),
        ],
        const SizedBox(height: 16),
        permissionsAsync.when(
          loading: () => const _SectionShimmer(height: 140),
          error: (_, _) => const SizedBox.shrink(),
          data: (grants) => _PermissionsSection(
            user: user,
            grants: grants,
            canManage: canManage,
          ),
        ),
      ],
    );
  }
}

class _IdentityCard extends StatelessWidget {
  const _IdentityCard({required this.user});

  final User user;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: const Color(0xFFeef0f3)),
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
                        color: Color(0xFF0f1729),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      user.email,
                      style: const TextStyle(
                        fontSize: 12.5,
                        color: Color(0xFF6b7280),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        RoleBadge(role: user.role.name),
                        const SizedBox(width: 6),
                        StatusBadge(status: user.status),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          const Divider(height: 1, color: Color(0xFFf1f3f6)),
          const SizedBox(height: 12),
          Row(
            children: [
              _VerificationChip(label: 'Email', verified: user.emailVerified),
              const SizedBox(width: 8),
              _VerificationChip(
                label: 'Telefone',
                verified: user.phoneVerified,
              ),
              const SizedBox(width: 8),
              _VerificationChip(label: '2FA', verified: user.twoFactorEnabled),
            ],
          ),
          const SizedBox(height: 14),
          const Divider(height: 1, color: Color(0xFFf1f3f6)),
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
    final color = verified ? const Color(0xFF16a373) : const Color(0xFF9ca3af);
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

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return _SectionCard(
      title: 'Atribuições',
      trailing: canManage
          ? TextButton(
              onPressed: () async {
                await ManageAssignmentsSheet.show(
                  context,
                  user: user,
                  assignments: assignments,
                );
                ref.invalidate(userAssignmentsProvider(user.id));
              },
              child: const Text('Gerenciar'),
            )
          : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (user.role.name == UserRoleName.rep) ...[
            _DetailRow(
              label: 'Gerente',
              value: assignments.managerName ?? 'Sem gerente',
            ),
            const SizedBox(height: 12),
          ],
          const Text(
            'Setores',
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
              color: Color(0xFF6b7280),
            ),
          ),
          const SizedBox(height: 6),
          assignments.sectors.isEmpty
              ? const Text(
                  'Nenhum setor atribuído.',
                  style: TextStyle(fontSize: 13, color: Color(0xFF9ca3af)),
                )
              : Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: assignments.sectors
                      .map((s) => _Pill(label: s.sectorName))
                      .toList(),
                ),
          if (assignments.isOperationallyActive) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                const Icon(
                  Icons.bolt_rounded,
                  size: 14,
                  color: Color(0xFF16a373),
                ),
                const SizedBox(width: 4),
                const Text(
                  'Operacionalmente ativo',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF16a373),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _TerritoryMapsSection extends StatelessWidget {
  const _TerritoryMapsSection({required this.assignments});

  final UserAssignments assignments;

  @override
  Widget build(BuildContext context) {
    final territories = assignments.territories;
    return _SectionCard(
      title: 'Territórios atribuídos',
      child: territories.isEmpty
          ? const Text(
              'Nenhum território atribuído.',
              style: TextStyle(fontSize: 13, color: Color(0xFF9ca3af)),
            )
          : SizedBox(
              height: 150,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                physics: const BouncingScrollPhysics(),
                clipBehavior: Clip.none,
                itemCount: territories.length,
                separatorBuilder: (_, _) => const SizedBox(width: 10),
                itemBuilder: (context, index) =>
                    TerritoryMapCard(assignment: territories[index]),
              ),
            ),
    );
  }
}

class _PermissionsSection extends ConsumerWidget {
  const _PermissionsSection({
    required this.user,
    required this.grants,
    required this.canManage,
  });

  final User user;
  final List<PermissionGrant> grants;
  final bool canManage;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return _SectionCard(
      title: 'Permissões extras',
      trailing: canManage
          ? TextButton(
              onPressed: () async {
                await ManagePermissionsSheet.show(
                  context,
                  user: user,
                  grants: grants,
                );
                ref.invalidate(userPermissionsProvider(user.id));
              },
              child: const Text('Gerenciar'),
            )
          : null,
      child: grants.isEmpty
          ? const Text(
              'Nenhuma permissão extra concedida.',
              style: TextStyle(fontSize: 13, color: Color(0xFF9ca3af)),
            )
          : Column(
              children: grants
                  .map(
                    (grant) => Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 3,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(
                                0xFF0a2f7f,
                              ).withValues(alpha: 0.08),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              grant.action.toUpperCase(),
                              style: const TextStyle(
                                fontSize: 10.5,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF0a2f7f),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              grant.resourceName ?? grant.resource,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 13,
                                color: Color(0xFF374151),
                              ),
                            ),
                          ),
                          if (grant.isExpired)
                            const Text(
                              'Expirado',
                              style: TextStyle(
                                fontSize: 11,
                                color: Color(0xFFb84545),
                              ),
                            ),
                        ],
                      ),
                    ),
                  )
                  .toList(),
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
        border: Border.all(color: const Color(0xFFeef0f3)),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0f1729),
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
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 13.5, color: Color(0xFF6b7280)),
        ),
        Text(
          value,
          style: const TextStyle(
            fontSize: 13.5,
            fontWeight: FontWeight.w600,
            color: Color(0xFF0f1729),
          ),
        ),
      ],
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: const Color(0xFFf3f4f6),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: Color(0xFF374151),
        ),
      ),
    );
  }
}

class _SectionShimmer extends StatelessWidget {
  const _SectionShimmer({required this.height});

  final double height;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: const Color(0xFFeef0f3)),
        borderRadius: BorderRadius.circular(16),
      ),
    );
  }
}
