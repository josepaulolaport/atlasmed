import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/core/user/role_capability_providers.dart';
import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_metrics.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/providers/dashboard_provider.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/providers/team_provider.dart';
import 'package:atlasmed_mobile_app/repository/repository_flutter.dart';
import 'package:atlasmed_mobile_app/router/routes.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:atlasmed_mobile_app/shared/widgets/app_shell.dart';
import 'package:atlasmed_mobile_app/shared/widgets/list_skeletons.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

const _sortLabels = <String, String>{
  'name': 'Nome',
  'assigned-clinics': 'Clínicas',
  'coverage': 'Cobertura',
  'cadastro-completion': 'Cadastro',
  'orders-month': 'Pedidos no mês',
  'penetration': 'Penetração',
  'unassigned-clinics': 'Sem representante',
};

const _percentSorts = {'coverage', 'cadastro-completion', 'penetration'};

/// Equipe (spec 0014 §6) — the roster, and the way into a person's Desempenho.
///
/// A manager sees their reps; an admin sees managers and drills into a
/// manager's team. Sorting by a metric shows that metric's value per person, so
/// the roster becomes a leaderboard on demand rather than by default.
class TeamScreen extends ConsumerStatefulWidget {
  const TeamScreen({super.key, this.managerId, this.managerName});

  final int? managerId;
  final String? managerName;

  @override
  ConsumerState<TeamScreen> createState() => _TeamScreenState();
}

class _TeamScreenState extends ConsumerState<TeamScreen> {
  String _sortBy = 'name';
  String _order = 'asc';

  @override
  Widget build(BuildContext context) {
    final verticalId = ref.watch(dashboardSelectedVerticalIdProvider);
    final role = ref.watch(currentUserRoleProvider);

    if (verticalId == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final args = TeamArgs(
      verticalId: verticalId,
      managerId: widget.managerId,
      sortBy: _sortBy,
      order: _order,
    );

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: widget.managerId == null
          ? const AtlasAppBar(page: 'Equipe')
          : AppBar(title: Text(widget.managerName ?? 'Equipe')),
      body: Column(
        children: [
          _SortBar(
            sortBy: _sortBy,
            order: _order,
            onChanged: (sortBy, order) => setState(() {
              _sortBy = sortBy;
              _order = order;
            }),
          ),
          // An exception report, not a roster entry — so it reads as a notice
          // rather than as the first person on the team. It also stops citing
          // a spec number at the user, which meant nothing to them.
          if (role == UserRoleName.admin && widget.managerId == null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 10),
              child: InkWell(
                borderRadius: BorderRadius.circular(12),
                onTap: () => const RepsWithoutPatchRoute().push(context),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.amber.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: AppColors.amber.withValues(alpha: 0.25),
                    ),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.report_problem_outlined,
                        size: 16,
                        color: AppColors.amber,
                      ),
                      const SizedBox(width: 10),
                      const Expanded(
                        child: Text(
                          'Representantes sem território',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: AppColors.gray900,
                          ),
                        ),
                      ),
                      const Icon(
                        Icons.chevron_right_rounded,
                        size: 16,
                        color: AppColors.gray500,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          Expanded(
            child: RefreshIndicator(
              color: AppColors.navyBright,
              backgroundColor: Colors.white,
              strokeWidth: 2.6,
              onRefresh: () async => ref.invalidate(teamProvider(args)),
              child: RepositoryBuilder(
                repository: ref.watch(teamProvider(args)),
                builder: (context, members, repo) {
                  if (members == null) {
                    // A skeleton, not a spinner: the rest of the app's lists
                    // load this way and `list_skeletons_test.dart` holds them
                    // to it.
                    return ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: const [TeamListSkeleton()],
                    );
                  }
                  final isManagerRoster =
                      widget.managerId == null && role != UserRoleName.manager;
                  if (members.isEmpty) {
                    // A ListView rather than a Center: an empty roster is
                    // exactly when someone reaches for pull-to-refresh, and a
                    // non-scrollable child never fires it.
                    return ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: [
                        _TeamEmptyState(isManagerRoster: isManagerRoster),
                      ],
                    );
                  }
                  // The largest value on screen, so each row can draw its own
                  // share of it. Sorting by name has no bar to scale.
                  final peak = _sortBy == 'name'
                      ? 0.0
                      : members.fold<double>(
                          0,
                          (max, m) => (m.metricValue ?? 0) > max
                              ? (m.metricValue ?? 0)
                              : max,
                        );
                  // No separator: each row draws its own bottom border, the
                  // same way Explorar's list does.
                  return ListView.builder(
                    physics: const AlwaysScrollableScrollPhysics(),
                    itemCount: members.length,
                    itemBuilder: (context, index) => _MemberTile(
                      member: members[index],
                      sortBy: _sortBy,
                      peakMetric: peak,
                      isManagerRoster: isManagerRoster,
                    ),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SortBar extends StatelessWidget {
  const _SortBar({
    required this.sortBy,
    required this.order,
    required this.onChanged,
  });

  final String sortBy;
  final String order;
  final void Function(String sortBy, String order) onChanged;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Row(
        children: [
          for (final entry in _sortLabels.entries)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ChoiceChip(
                label: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(entry.value),
                    if (sortBy == entry.key)
                      Icon(
                        order == 'asc'
                            ? Icons.arrow_upward_rounded
                            : Icons.arrow_downward_rounded,
                        size: 14,
                      ),
                  ],
                ),
                selected: sortBy == entry.key,
                onSelected: (_) => onChanged(
                  entry.key,
                  // Tapping the active chip flips the direction; a new chip
                  // starts ascending.
                  sortBy == entry.key && order == 'asc' ? 'desc' : 'asc',
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _MemberTile extends StatelessWidget {
  const _MemberTile({
    required this.member,
    required this.sortBy,
    required this.peakMetric,
    required this.isManagerRoster,
  });

  final TeamMember member;
  final String sortBy;

  /// The largest value in the roster, so a row can draw its share of it.
  ///
  /// A bare "447" says nothing about whether that is good. Scaling every bar to
  /// the leader turns the roster into something you can read at a glance, which
  /// is the whole point of sorting by a metric.
  final double peakMetric;

  final bool isManagerRoster;

  /// Built to match `ClinicRow` in Explorar rather than as a bare `ListTile`:
  /// the same bordered row, 44px rounded avatar, 15/w600 title and icon-led
  /// 11px meta. Two lists of people in one app should not look like they came
  /// from different products.
  @override
  Widget build(BuildContext context) {
    final territories = member.territories.map((t) => t.name).join(' · ');

    return InkWell(
      onTap: () {
        if (isManagerRoster && member.roleName == 'MANAGER') {
          TeamMemberRoute(
            managerId: member.userId,
            managerName: member.displayName,
          ).push(context);
          return;
        }
        SubjectDashboardRoute(
          subjectUserId: member.userId,
          subjectName: member.displayName,
          subjectRole: member.roleName,
        ).push(context);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: AppColors.surfaceSecondary)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
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
              alignment: Alignment.center,
              child: member.avatarUrl != null
                  ? null
                  : Text(
                      member.displayName.characters.first.toUpperCase(),
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: AppColors.navyBright,
                      ),
                    ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    member.displayName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    softWrap: false,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: AppColors.gray900,
                      letterSpacing: -0.15,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Wrap(
                    spacing: 8,
                    runSpacing: 4,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      // A manager holds no clinics directly — their number is
                      // their zones', and showing "0 clínicas" would read as a
                      // performance figure rather than a shape of the model.
                      if (member.assignedClinicCount > 0)
                        _MemberMeta(
                          icon: Icons.local_hospital_rounded,
                          text:
                              '${member.assignedClinicCount} '
                              '${member.assignedClinicCount == 1 ? 'clínica' : 'clínicas'}',
                        ),
                      if (territories.isNotEmpty)
                        _MemberMeta(
                          icon: Icons.layers_rounded,
                          text: territories,
                        ),
                    ],
                  ),
                  if (sortBy != 'name') ...[
                    const SizedBox(height: 7),
                    _MetricBar(
                      value: member.metricValue,
                      peak: peakMetric,
                      label: _sortLabels[sortBy] ?? '',
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 8),
            if (sortBy != 'name')
              Padding(
                padding: const EdgeInsets.only(top: 8, right: 4),
                child: Text(
                  _formatMetric(sortBy, member.metricValue),
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppColors.gray900,
                  ),
                ),
              ),
            // An admin's manager row leads to that manager's *team*, so their
            // own Desempenho had no way in at all (spec 0014 §2 puts it behind
            // "via profile"). One row cannot mean two destinations, so the
            // second one gets its own control.
            if (isManagerRoster && member.roleName == 'MANAGER')
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: IconButton(
                  visualDensity: VisualDensity.compact,
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(
                    minWidth: 36,
                    minHeight: 36,
                  ),
                  tooltip: 'Ver desempenho de ${member.displayName}',
                  icon: const Icon(
                    Icons.insights_rounded,
                    size: 18,
                    color: AppColors.navyBright,
                  ),
                  onPressed: () => SubjectDashboardRoute(
                    subjectUserId: member.userId,
                    subjectName: member.displayName,
                    subjectRole: member.roleName,
                  ).push(context),
                ),
              )
            else
              const Padding(
                padding: EdgeInsets.only(top: 12),
                child: Icon(
                  Icons.chevron_right_rounded,
                  size: 18,
                  color: AppColors.gray500,
                ),
              ),
          ],
        ),
      ),
    );
  }

  /// `—` for a value the API could not calculate. Rendering 0 would put a
  /// person at the bottom of a leaderboard for having no data.
  static String _formatMetric(String sortBy, double? value) {
    if (value == null) return '—';
    if (_percentSorts.contains(sortBy)) return '${(value * 100).round()}%';
    return '${value.round()}';
  }
}

/// One icon-led fact under a person's name — the shape Explorar's rows use.
class _MemberMeta extends StatelessWidget {
  const _MemberMeta({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 11, color: AppColors.gray500),
        const SizedBox(width: 4),
        Flexible(
          child: Text(
            text,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w500,
              color: AppColors.gray500,
            ),
          ),
        ),
      ],
    );
  }
}

/// Reps with no active patch (spec 0009 R8 / 0014 §6).
class RepsWithoutPatchScreen extends ConsumerWidget {
  const RepsWithoutPatchScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Representantes sem território')),
      body: RefreshIndicator(
        color: AppColors.navyBright,
        backgroundColor: Colors.white,
        strokeWidth: 2.6,
        onRefresh: () async => ref.invalidate(repsWithoutPatchProvider),
        child: RepositoryBuilder(
          repository: ref.watch(repsWithoutPatchProvider),
          builder: (context, members, repo) {
            if (members == null) {
              return const Center(child: CircularProgressIndicator());
            }
            if (members.isEmpty) {
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: const [
                  Padding(
                    padding: EdgeInsets.symmetric(horizontal: 32, vertical: 64),
                    child: Text(
                      'Todo representante tem um território.',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 14, color: Color(0xFF6b7280)),
                    ),
                  ),
                ],
              );
            }
            return ListView.builder(
              physics: const AlwaysScrollableScrollPhysics(),
              itemCount: members.length,
              itemBuilder: (context, index) {
                final member = members[index];
                return _PersonRow(
                  title: member.displayName,
                  subtitle: member.email,
                  subtitleIcon: Icons.mail_outline_rounded,
                  onTap: () => UserDetailRoute(id: member.userId).push(context),
                );
              },
            );
          },
        ),
      ),
    );
  }
}

/// A person row in the Explorar shape, for the lists that carry no metrics.
class _PersonRow extends StatelessWidget {
  const _PersonRow({
    required this.title,
    required this.subtitle,
    required this.subtitleIcon,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final IconData subtitleIcon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: AppColors.surfaceSecondary)),
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [AppColors.blue100, AppColors.blueLight],
                ),
              ),
              child: Text(
                title.characters.first.toUpperCase(),
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: AppColors.navyBright,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: AppColors.gray900,
                      letterSpacing: -0.15,
                    ),
                  ),
                  const SizedBox(height: 3),
                  _MemberMeta(icon: subtitleIcon, text: subtitle),
                ],
              ),
            ),
            const Icon(
              Icons.chevron_right_rounded,
              size: 18,
              color: AppColors.gray500,
            ),
          ],
        ),
      ),
    );
  }
}

/// One person's share of the roster's largest value.
///
/// Scaled to the leader rather than to 100%: for a count like "clínicas" there
/// is no natural ceiling, and for a percentage a full-width bar at 3% would be
/// a lie. Relative is the only honest reading, and it is also the one that
/// answers the question people bring to a leaderboard.
class _MetricBar extends StatelessWidget {
  const _MetricBar({
    required this.value,
    required this.peak,
    required this.label,
  });

  final double? value;
  final double peak;
  final String label;

  @override
  Widget build(BuildContext context) {
    // No value means the metric could not be calculated for this person, which
    // is not the same as zero — so there is no bar to draw, only the reason.
    if (value == null) {
      return Text(
        'sem $label',
        style: const TextStyle(fontSize: 11, color: AppColors.gray500),
      );
    }
    final fraction = peak <= 0 ? 0.0 : (value! / peak).clamp(0.0, 1.0);

    return ClipRRect(
      borderRadius: BorderRadius.circular(999),
      child: LinearProgressIndicator(
        value: fraction,
        minHeight: 4,
        backgroundColor: AppColors.surfaceSecondary,
        valueColor: const AlwaysStoppedAnimation(AppColors.navyBright),
      ),
    );
  }
}

/// An empty roster, explained.
///
/// "Nenhuma pessoa nesta equipe" is true and useless. The two ways to get here
/// have different causes and different fixes, and saying which one you are
/// looking at is the difference between a dead end and a next step.
class _TeamEmptyState extends StatelessWidget {
  const _TeamEmptyState({required this.isManagerRoster});

  final bool isManagerRoster;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 56),
      child: Column(
        children: [
          Icon(
            isManagerRoster ? Icons.groups_outlined : Icons.person_off_outlined,
            size: 28,
            color: AppColors.gray500,
          ),
          const SizedBox(height: 12),
          Text(
            isManagerRoster
                ? 'Nenhum gestor com zona nesta linha'
                : 'Nenhum representante nesta equipe',
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: AppColors.gray900,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            isManagerRoster
                ? 'A equipe aparece quando um gestor assume uma zona desta linha.'
                : 'Os representantes aparecem quando um patch é criado dentro das zonas do gestor.',
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 12.5,
              color: AppColors.gray500,
              height: 1.35,
            ),
          ),
        ],
      ),
    );
  }
}
