import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/core/user/role_capability_providers.dart';
import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_metrics.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/providers/dashboard_provider.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/providers/team_provider.dart';
import 'package:atlasmed_mobile_app/repository/repository_flutter.dart';
import 'package:atlasmed_mobile_app/router/routes.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:atlasmed_mobile_app/shared/widgets/app_shell.dart';
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
          if (role == UserRoleName.admin && widget.managerId == null)
            ListTile(
              leading: const Icon(Icons.report_problem_outlined),
              title: const Text('Representantes sem território'),
              subtitle: const Text(
                'Sem gestor, sem equipe e sem clínicas (spec 0009 R8)',
              ),
              trailing: const Icon(Icons.chevron_right_rounded),
              onTap: () => const RepsWithoutPatchRoute().push(context),
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
                    return const Center(child: CircularProgressIndicator());
                  }
                  if (members.isEmpty) {
                    // A ListView rather than a Center: an empty roster is
                    // exactly when someone reaches for pull-to-refresh, and a
                    // non-scrollable child never fires it.
                    return ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: const [
                        Padding(
                          padding: EdgeInsets.symmetric(
                            horizontal: 32,
                            vertical: 64,
                          ),
                          child: Text(
                            'Nenhuma pessoa nesta equipe.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 14,
                              color: Color(0xFF6b7280),
                            ),
                          ),
                        ),
                      ],
                    );
                  }
                  return ListView.separated(
                    physics: const AlwaysScrollableScrollPhysics(),
                    itemCount: members.length,
                    separatorBuilder: (_, _) => const Divider(height: 1),
                    itemBuilder: (context, index) => _MemberTile(
                      member: members[index],
                      sortBy: _sortBy,
                      isManagerRoster:
                          widget.managerId == null &&
                          role != UserRoleName.manager,
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
    required this.isManagerRoster,
  });

  final TeamMember member;
  final String sortBy;
  final bool isManagerRoster;

  @override
  Widget build(BuildContext context) {
    final territories = member.territories.map((t) => t.name).join(', ');
    final subtitle = [
      if (member.assignedClinicCount > 0)
        '${member.assignedClinicCount} clínicas',
      if (territories.isNotEmpty) territories,
    ].join(' · ');

    return ListTile(
      leading: CircleAvatar(
        backgroundImage: member.avatarUrl == null
            ? null
            : NetworkImage(member.avatarUrl!),
        child: member.avatarUrl == null
            ? Text(member.displayName.characters.first.toUpperCase())
            : null,
      ),
      title: Text(member.displayName),
      subtitle: subtitle.isEmpty ? null : Text(subtitle),
      trailing: sortBy == 'name'
          ? const Icon(Icons.chevron_right_rounded)
          : Text(
              _formatMetric(sortBy, member.metricValue),
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
            ),
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
            return ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              itemCount: members.length,
              separatorBuilder: (_, _) => const Divider(height: 1),
              itemBuilder: (context, index) {
                final member = members[index];
                return ListTile(
                  title: Text(member.displayName),
                  subtitle: Text(member.email),
                  trailing: const Icon(Icons.chevron_right_rounded),
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
