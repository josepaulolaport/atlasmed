import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/core/user/role_capability_providers.dart';
import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_metrics.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/providers/dashboard_provider.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/providers/team_provider.dart';
import 'package:atlasmed_mobile_app/repository/repository_flutter.dart';
import 'package:atlasmed_mobile_app/router/routes.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/screens/agenda_month_screen.dart';
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
            // Território is not a row here: the map below names it and draws
            // it, and a row repeating the name says strictly less.
            (
              Icons.event_outlined,
              'Membro desde',
              _monthYear(member.memberSince),
            ),
            // Absent rather than "nunca" when there is nothing: an account that
            // has never been opened is better said by the PENDING chip above.
            if (member.lastSeenAt != null)
              (
                Icons.schedule_rounded,
                'Último acesso',
                _sinceLabel(member.lastSeenAt!),
              ),
          ],
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
        // Only a rep has an agenda: a manager's own calendar is not what the
        // team page is about, and it would open empty.
        if (member.isRep) ...[
          const SizedBox(height: 10),
          _LinkCard(
            icon: Icons.calendar_month_outlined,
            title: 'Agenda',
            subtitle: 'Ver os compromissos e roteiros desta pessoa',
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => AgendaMonthScreen(
                  ownerUserId: member.userId,
                  ownerName: member.displayName,
                ),
              ),
            ),
          ),
        ],
        const SizedBox(height: 10),
        _LinkCard(
          icon: Icons.local_hospital_rounded,
          title: member.isRep ? 'Clínicas associadas' : 'Clínicas nas zonas',
          trailing: '${member.assignedClinicCount}',
          subtitle: member.assignedClinicCount == 0
              ? 'Nenhuma clínica nesta área'
              : member.isRep
              ? 'Ver e gerenciar as clínicas desta pessoa'
              : 'Todas as clínicas dentro das zonas deste gestor',
          onTap: member.assignedClinicCount == 0
              ? null
              : () => MetricClinicsRoute(
                  metric: 'assigned-clinics',
                  verticalId: verticalId,
                  subjectUserId: member.userId,
                  withinManagerId: viaManagerId,
                  // Only a rep's list is actionable. A manager's clinics are
                  // derived from geometry — nothing is assigned *to* them — so
                  // "desassociar" there would end some rep's assignment under
                  // the manager's name. A manager loses clinics by their zone
                  // changing, which is the map's job, not a menu's.
                  manageForUserId: member.isRep ? member.userId : null,
                  manageForName: member.isRep ? member.displayName : null,
                ).push(context),
        ),
        // Only a rep can hold a clinic, so a manager's profile has nothing to
        // assign — their reps do, one level down.
        if (member.isRep && canAssign) ...[
          const SizedBox(height: 10),
          _LinkCard(
            icon: Icons.add_location_alt_outlined,
            title: 'Associar nova clínica',
            subtitle: 'Sem representante, ou já com outro — com justificativa',
            onTap: () => AssignClinicRoute(
              userId: member.userId,
              memberName: member.displayName,
            ).push(context),
          ),
        ],
        // A manager answers for the gap in their ground; a rep cannot, because
        // a clinic nobody holds is not in a rep's denominator at all. Shown
        // even at zero — "nenhuma clínica descoberta" is worth stating, unlike
        // an absent problem elsewhere on this screen.
        if (member.unassignedClinicCount != null) ...[
          const SizedBox(height: 10),
          _LinkCard(
            icon: Icons.person_off_outlined,
            accent: member.unassignedClinicCount! > 0
                ? AppColors.amber
                : AppColors.navyBright,
            title: 'Clínicas sem representante',
            trailing: '${member.unassignedClinicCount}',
            subtitle: member.unassignedClinicCount! > 0
                ? 'Dentro das zonas, sem ninguém atendendo'
                : 'Toda a zona está coberta',
            onTap: member.unassignedClinicCount! == 0
                ? null
                : () => MetricClinicsRoute(
                    metric: 'unassigned-clinics',
                    verticalId: verticalId,
                    subjectUserId: member.userId,
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

  /// "há 2 dias" rather than a date.
  ///
  /// The question this answers is "is this person still using the app", and a
  /// timestamp makes the reader do the subtraction — which is the whole content
  /// of the answer.
  static String _sinceLabel(DateTime when) {
    final elapsed = DateTime.now().difference(when);
    if (elapsed.inMinutes < 5) return 'agora';
    if (elapsed.inHours < 1) return 'há ${elapsed.inMinutes} min';
    if (elapsed.inHours < 24) {
      return 'há ${elapsed.inHours} ${elapsed.inHours == 1 ? 'hora' : 'horas'}';
    }
    if (elapsed.inDays < 30) {
      return 'há ${elapsed.inDays} ${elapsed.inDays == 1 ? 'dia' : 'dias'}';
    }
    return _monthYear(when);
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
