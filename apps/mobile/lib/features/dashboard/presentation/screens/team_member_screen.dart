import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/core/user/role_capability_providers.dart';
import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_metrics.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/providers/dashboard_provider.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/providers/team_provider.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/widgets/member_territory_view.dart';
import 'package:atlasmed_mobile_app/repository/repository_flutter.dart';
import 'package:atlasmed_mobile_app/router/routes.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// One team member (spec 0015 §4).
///
/// Equipe answers *who*, and this is that answer in full. Nothing here is
/// editable: identity belongs to Usuários, and territory to the map. Every
/// deeper question leaves — Desempenho for the numbers, Explorar for the
/// clinics — rather than being reproduced in miniature.
///
/// The figures are scoped server-side to the reader's own zones, so they equal
/// the roster row that opened this screen rather than merely resembling it.
class TeamMemberScreen extends ConsumerWidget {
  const TeamMemberScreen({
    super.key,
    required this.userId,
    this.memberName,
    this.viaManagerId,
  });

  final int userId;
  final String? memberName;

  /// The manager whose team this person was reached through, carried into
  /// Desempenho so the drill-down reads the same population (spec 0015 R2).
  final int? viaManagerId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final verticalId = ref.watch(dashboardSelectedVerticalIdProvider);
    if (verticalId == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final args = TeamMemberArgs(verticalId: verticalId, userId: userId);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: Text(memberName ?? 'Membro')),
      body: RefreshIndicator(
        color: AppColors.navyBright,
        backgroundColor: Colors.white,
        strokeWidth: 2.6,
        onRefresh: () async => ref.invalidate(teamMemberProvider(args)),
        child: RepositoryBuilder(
          repository: ref.watch(teamMemberProvider(args)),
          builder: (context, member, repo) {
            if (member == null) {
              return const Center(child: CircularProgressIndicator());
            }
            return _Profile(
              member: member,
              viaManagerId: viaManagerId,
              verticalId: verticalId,
            );
          },
        ),
      ),
    );
  }
}

class _Profile extends ConsumerWidget {
  const _Profile({
    required this.member,
    required this.viaManagerId,
    required this.verticalId,
  });

  final TeamMemberProfile member;
  final int? viaManagerId;
  final int verticalId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final role = ref.watch(currentUserRoleProvider);
    final territories = member.territories.map((t) => t.name).join(' · ');
    // Only an admin reaches a manager's own team from here; a manager's roster
    // is their reps, and a rep has no team at all.
    final showsTeam =
        !member.isRep &&
        (role == UserRoleName.admin || role == UserRoleName.ops);
    // Spec 0015 R3: OPS reads everything and changes nothing.
    final canAssign =
        role == UserRoleName.admin || role == UserRoleName.manager;

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      children: [
        _Identity(member: member),
        const SizedBox(height: 16),
        _InfoCard(
          rows: [
            (Icons.mail_outline_rounded, 'E-mail', member.email),
            if (member.phoneNumber != null)
              (Icons.phone_outlined, 'Telefone', member.phoneNumber!),
            if (territories.isNotEmpty)
              (Icons.layers_rounded, 'Território', territories),
            (
              Icons.event_outlined,
              'Membro desde',
              _monthYear(member.memberSince),
            ),
          ],
        ),
        const SizedBox(height: 16),
        _TerritoryCard(
          userId: member.userId,
          memberName: member.displayName,
          viaManagerId: viaManagerId,
          isRep: member.isRep,
          verticalId: verticalId,
        ),
        const SizedBox(height: 16),
        _LinkCard(
          icon: Icons.insights_rounded,
          title: 'Desempenho',
          subtitle: 'Cobertura, cadastro, pedidos e penetração',
          onTap: () => SubjectDashboardRoute(
            subjectUserId: member.userId,
            subjectName: member.displayName,
            subjectRole: member.roleName,
            withinManagerId: viaManagerId,
          ).push(context),
        ),
        const SizedBox(height: 10),
        _LinkCard(
          icon: Icons.local_hospital_rounded,
          title: 'Clínicas associadas',
          trailing: '${member.assignedClinicCount}',
          subtitle: member.assignedClinicCount == 0
              ? 'Nenhuma clínica nesta área'
              : 'Ver e gerenciar as clínicas desta pessoa',
          onTap: member.assignedClinicCount == 0
              ? null
              : () => MetricClinicsRoute(
                  metric: 'assigned-clinics',
                  verticalId: verticalId,
                  subjectUserId: member.userId,
                  withinManagerId: viaManagerId,
                  manageForUserId: member.userId,
                  manageForName: member.displayName,
                ).push(context),
        ),
        // Only a rep can hold a clinic, so a manager's profile has nothing to
        // assign — their reps do, one level down.
        if (member.isRep && canAssign) ...[
          const SizedBox(height: 10),
          _LinkCard(
            icon: Icons.add_location_alt_outlined,
            title: 'Associar nova clínica',
            subtitle: 'Livres no território, ou fora dele com justificativa',
            onTap: () => AssignClinicRoute(
              userId: member.userId,
              memberName: member.displayName,
            ).push(context),
          ),
        ],
        // Spec 0009 R2 promised this report and nothing ever showed it. Absent
        // when there are none, because "0 fora do território" is a sentence
        // about a problem that does not exist.
        if (member.outOfTerritoryCount > 0) ...[
          const SizedBox(height: 10),
          _LinkCard(
            icon: Icons.warning_amber_rounded,
            accent: AppColors.amber,
            title: 'Clínicas fora do território',
            trailing: '${member.outOfTerritoryCount}',
            subtitle: 'Atribuídas com justificativa, fora dos patches',
            onTap: () => OutOfTerritoryRoute(
              userId: member.userId,
              memberName: member.displayName,
            ).push(context),
          ),
        ],
        if (showsTeam) ...[
          const SizedBox(height: 10),
          _LinkCard(
            icon: Icons.groups_rounded,
            title: 'Equipe',
            subtitle: 'Representantes sob este gestor',
            onTap: () => TeamMemberRoute(
              managerId: member.userId,
              managerName: member.displayName,
            ).push(context),
          ),
        ],
      ],
    );
  }

  static String _monthYear(DateTime date) {
    const months = [
      'jan',
      'fev',
      'mar',
      'abr',
      'mai',
      'jun',
      'jul',
      'ago',
      'set',
      'out',
      'nov',
      'dez',
    ];
    return '${months[date.month - 1]}. de ${date.year}';
  }
}

/// The territory, previewed (spec 0015 R8).
///
/// The same widget the fullscreen view uses, so tapping enlarges what you were
/// already looking at. A rep with no patch gets the call to action instead of an
/// empty grey box — that state is the whole reason the card is on the profile.
class _TerritoryCard extends ConsumerWidget {
  const _TerritoryCard({
    required this.userId,
    required this.memberName,
    required this.viaManagerId,
    required this.isRep,
    required this.verticalId,
  });

  final int userId;
  final String memberName;
  final int? viaManagerId;
  final bool isRep;
  final int verticalId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final args = MemberTerritoryArgs(
      verticalId: verticalId,
      userId: userId,
      viaManagerId: viaManagerId,
    );

    void open() => MemberTerritoryRoute(
      userId: userId,
      memberName: memberName,
      viaManagerId: viaManagerId,
      isRep: isRep,
    ).push(context);

    return RepositoryBuilder(
      repository: ref.watch(memberTerritoryProvider(args)),
      builder: (context, map, repo) {
        if (map == null) {
          return Container(
            height: 170,
            decoration: BoxDecoration(
              color: AppColors.surfaceSecondary,
              borderRadius: BorderRadius.circular(14),
            ),
          );
        }

        if (map.subject.isEmpty) {
          return _EmptyTerritory(isRep: isRep, onDraw: open);
        }

        return ClipRRect(
          borderRadius: BorderRadius.circular(14),
          child: Stack(
            children: [
              MemberTerritoryView(map: map),
              Positioned.fill(
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(onTap: open),
                ),
              ),
              Positioned(
                left: 10,
                bottom: 10,
                child: _MapChip(
                  label: map.subject.length == 1
                      ? map.subject.first.name
                      : '${map.subject.length} áreas',
                ),
              ),
              const Positioned(
                right: 10,
                bottom: 10,
                child: _MapChip(label: 'Abrir'),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _MapChip extends StatelessWidget {
  const _MapChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(999),
        boxShadow: const [
          BoxShadow(
            color: Color(0x14000000),
            blurRadius: 6,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 11.5,
          fontWeight: FontWeight.w600,
          color: AppColors.gray900,
        ),
      ),
    );
  }
}

/// Someone holding no ground. The single most useful thing this screen can say.
class _EmptyTerritory extends StatelessWidget {
  const _EmptyTerritory({required this.isRep, required this.onDraw});

  final bool isRep;
  final VoidCallback onDraw;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.amber.withValues(alpha: 0.35)),
      ),
      child: Column(
        children: [
          const Icon(
            Icons.layers_clear_outlined,
            size: 26,
            color: AppColors.amber,
          ),
          const SizedBox(height: 10),
          Text(
            isRep ? 'Sem território' : 'Sem zona nesta linha',
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: AppColors.gray900,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            isRep
                ? 'Sem um patch, esta pessoa não aparece em nenhuma equipe e não pode receber clínicas.'
                : 'Sem uma zona, este gestor não tem representantes nem clínicas nesta linha.',
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 12.5,
              color: AppColors.gray500,
              height: 1.35,
            ),
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: onDraw,
            icon: const Icon(Icons.draw_outlined, size: 18),
            label: const Text('Desenhar área'),
          ),
        ],
      ),
    );
  }
}

/// Avatar, name, role, and the account's own state.
///
/// Status earns its place because it is operational: a suspended rep still
/// holds a patch and still appears on the roster, and nothing else on the
/// screen would say why their numbers stopped moving.
class _Identity extends StatelessWidget {
  const _Identity({required this.member});

  final TeamMemberProfile member;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 60,
          height: 60,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [AppColors.blue100, AppColors.blueLight],
            ),
            image: member.avatarUrl == null
                ? null
                : DecorationImage(
                    image: NetworkImage(member.avatarUrl!),
                    fit: BoxFit.cover,
                  ),
          ),
          child: member.avatarUrl != null
              ? null
              : Text(
                  member.displayName.characters.first.toUpperCase(),
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    color: AppColors.navyBright,
                  ),
                ),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                member.displayName,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 19,
                  fontWeight: FontWeight.w700,
                  color: AppColors.gray900,
                  letterSpacing: -0.3,
                ),
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  _Chip(
                    label: member.isRep ? 'Representante' : 'Gestor',
                    color: AppColors.navyBright,
                  ),
                  if (member.status != 'ACTIVE') ...[
                    const SizedBox(width: 6),
                    _Chip(
                      label: _statusLabel(member.status),
                      color: AppColors.amber,
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  static String _statusLabel(String status) => switch (status) {
    'PENDING' => 'Convite pendente',
    'INACTIVE' => 'Inativo',
    'SUSPENDED' => 'Suspenso',
    _ => status,
  };
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: color,
        ),
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({required this.rows});

  final List<(IconData, String, String)> rows;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.surfaceSecondary),
      ),
      child: Column(
        children: [
          for (var i = 0; i < rows.length; i++)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                border: i == rows.length - 1
                    ? null
                    : const Border(
                        bottom: BorderSide(color: AppColors.surfaceSecondary),
                      ),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(rows[i].$1, size: 15, color: AppColors.gray500),
                  const SizedBox(width: 10),
                  Text(
                    rows[i].$2,
                    style: const TextStyle(
                      fontSize: 12.5,
                      color: AppColors.gray500,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      rows[i].$3,
                      textAlign: TextAlign.right,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppColors.gray900,
                      ),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// A card that leads somewhere. Disabled when the destination would be empty —
/// a chevron into nothing is a worse answer than a greyed row.
class _LinkCard extends StatelessWidget {
  const _LinkCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.trailing,
    this.accent = AppColors.navyBright,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final String? trailing;
  final Color accent;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null;

    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: onTap,
      child: Opacity(
        opacity: enabled ? 1 : 0.55,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.surfaceSecondary),
          ),
          child: Row(
            children: [
              Container(
                width: 34,
                height: 34,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, size: 18, color: accent),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w600,
                        color: AppColors.gray900,
                        letterSpacing: -0.15,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: const TextStyle(
                        fontSize: 11.5,
                        color: AppColors.gray500,
                        height: 1.3,
                      ),
                    ),
                  ],
                ),
              ),
              if (trailing != null) ...[
                const SizedBox(width: 10),
                Text(
                  trailing!,
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    color: AppColors.gray900,
                    letterSpacing: -0.3,
                  ),
                ),
              ],
              const SizedBox(width: 6),
              const Icon(
                Icons.chevron_right_rounded,
                size: 18,
                color: AppColors.gray500,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
