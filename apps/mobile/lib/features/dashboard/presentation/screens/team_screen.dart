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

/// Sorts the row itself already answers, so no trailing column is needed.
const _rowMetricSorts = {
  'assigned-clinics',
  'coverage',
  'cadastro-completion',
  'orders-month',
};

/// Above this many people, scanning stops working and you need to search.
const _searchThreshold = 8;

/// The sorts worth offering for a given roster.
///
/// "Sem representante" counts the clinics inside someone's zones that nobody
/// holds — a rep has no zones, so on a rep roster the API can only answer null
/// for everyone. Offering it there is offering an order that does not exist.
List<MapEntry<String, String>> _sortOptions({required bool isManagerRoster}) {
  return _sortLabels.entries
      .where((e) => isManagerRoster || e.key != 'unassigned-clinics')
      .toList(growable: false);
}

/// Equipe (spec 0014 §6) — the roster, and the way into a person's Desempenho.
///
/// A manager sees their reps; an admin sees managers and drills into a
/// manager's team.
///
/// Equipe answers *who*, Desempenho answers *how much* — so this screen keeps
/// what is true of a person (their clinics, their territory, their standing
/// against the team) and sends every deeper question to Desempenho rather than
/// reproducing a smaller version of it here.
///
/// Every row therefore carries the same three figures at all times, and sorting
/// reorders the roster instead of changing what a row will tell you. It used to
/// do both: only the sorted metric had a value, so comparing two people on two
/// things meant sorting twice and remembering the first answer.
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
  String _search = '';

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
      body: RefreshIndicator(
        color: AppColors.navyBright,
        backgroundColor: Colors.white,
        strokeWidth: 2.6,
        onRefresh: () async => ref.invalidate(teamProvider(args)),
        child: RepositoryBuilder(
          repository: ref.watch(teamProvider(args)),
          builder: (context, members, repo) {
            if (members == null) {
              // A skeleton, not a spinner: the rest of the app's lists load
              // this way and `list_skeletons_test.dart` holds them to it.
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: const [TeamListSkeleton()],
              );
            }
            final isManagerRoster =
                widget.managerId == null && role != UserRoleName.manager;
            if (members.isEmpty) {
              // A ListView rather than a Center: an empty roster is exactly
              // when someone reaches for pull-to-refresh, and a non-scrollable
              // child never fires it.
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: [_TeamEmptyState(isManagerRoster: isManagerRoster)],
              );
            }

            final visible = _filter(members);
            // Scaled across the whole roster, never the search result: a bar
            // that regrew as you typed would make the same person look
            // stronger for having been filtered to.
            final peak = members.fold<double>(0, (max, m) {
              final value = (m.metrics?.assignedClinics ?? 0).toDouble();
              return value > max ? value : max;
            });

            return ListView.builder(
              physics: const AlwaysScrollableScrollPhysics(),
              // Header, plus the empty-search notice when it applies.
              itemCount: visible.length + (visible.isEmpty ? 2 : 1),
              itemBuilder: (context, index) {
                if (index == 0) {
                  return _RosterHeader(
                    members: members,
                    isManagerRoster: isManagerRoster,
                    showExceptions:
                        role == UserRoleName.admin && widget.managerId == null,
                    showSearch: members.length >= _searchThreshold,
                    search: _search,
                    onSearch: (value) => setState(() => _search = value),
                    sortBy: _sortBy,
                    order: _order,
                    onSort: (sortBy, order) => setState(() {
                      _sortBy = sortBy;
                      _order = order;
                    }),
                    manager: widget.managerId == null
                        ? null
                        : (
                            id: widget.managerId!,
                            name: widget.managerName ?? 'Gestor',
                          ),
                  );
                }
                if (visible.isEmpty) return _NoSearchMatch(term: _search);
                return _MemberTile(
                  member: visible[index - 1],
                  sortBy: _sortBy,
                  peakClinics: peak,
                  isManagerRoster: isManagerRoster,
                  viaManagerId: widget.managerId,
                );
              },
            );
          },
        ),
      ),
    );
  }

  /// Filtering happens here rather than on the server: the roster is already
  /// loaded in full, and a request per keystroke would make finding someone
  /// slower than scrolling to them.
  List<TeamMember> _filter(List<TeamMember> members) {
    final term = _search.trim().toLowerCase();
    if (term.isEmpty) return members;
    return members
        .where((member) {
          final territories = member.territories.map((t) => t.name).join(' ');
          return '${member.displayName} ${member.email} $territories'
              .toLowerCase()
              .contains(term);
        })
        .toList(growable: false);
  }
}

/// What sits above the roster: the team as one line, then the controls.
///
/// The totals come from the rows themselves rather than from a second request.
/// That is deliberate — a header computed from a different query could disagree
/// with the list underneath it, and a screen that contradicts itself is worse
/// than one that shows less.
class _RosterHeader extends StatelessWidget {
  const _RosterHeader({
    required this.members,
    required this.isManagerRoster,
    required this.showExceptions,
    required this.showSearch,
    required this.search,
    required this.onSearch,
    required this.sortBy,
    required this.order,
    required this.onSort,
    required this.manager,
  });

  final List<TeamMember> members;
  final bool isManagerRoster;
  final bool showExceptions;
  final bool showSearch;
  final String search;
  final ValueChanged<String> onSearch;
  final String sortBy;
  final String order;
  final void Function(String sortBy, String order) onSort;

  /// Set only on a drill-down, where the roster belongs to one named person.
  final ({int id, String name})? manager;

  @override
  Widget build(BuildContext context) {
    var clinics = 0;
    var orders = 0;
    var covered = 0.0;
    for (final member in members) {
      final metrics = member.metrics;
      if (metrics == null) continue;
      clinics += metrics.assignedClinics;
      orders += metrics.ordersMonth;
      // Weighted by clinics, not a mean of percentages: averaging 100% of two
      // clinics with 2% of five hundred would report the team as doing well.
      covered += (metrics.coveragePercent ?? 0) * metrics.assignedClinics;
    }
    final coverage = clinics == 0 ? null : covered / clinics;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: _SummaryStrip(
            people: members.length,
            isManagerRoster: isManagerRoster,
            clinics: clinics,
            coverage: coverage,
            orders: orders,
            manager: manager,
          ),
        ),
        if (showExceptions)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: _ExceptionBand(
              onTap: () => const RepsWithoutPatchRoute().push(context),
            ),
          ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
          child: Row(
            children: [
              if (showSearch)
                Expanded(
                  child: _SearchField(value: search, onChanged: onSearch),
                )
              else
                const Spacer(),
              const SizedBox(width: 8),
              _SortButton(
                sortBy: sortBy,
                order: order,
                onSort: onSort,
                isManagerRoster: isManagerRoster,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// The team in one line, and the way into its Desempenho.
class _SummaryStrip extends StatelessWidget {
  const _SummaryStrip({
    required this.people,
    required this.isManagerRoster,
    required this.clinics,
    required this.coverage,
    required this.orders,
    required this.manager,
  });

  final int people;
  final bool isManagerRoster;
  final int clinics;
  final double? coverage;
  final int orders;
  final ({int id, String name})? manager;

  @override
  Widget build(BuildContext context) {
    final noun = isManagerRoster
        ? (people == 1 ? 'gestor' : 'gestores')
        : (people == 1 ? 'representante' : 'representantes');

    final card = Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.surfaceSecondary),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '$people $noun',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.gray900,
                    letterSpacing: -0.1,
                  ),
                ),
              ),
              if (manager != null)
                const Row(
                  children: [
                    Text(
                      'Ver desempenho',
                      style: TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w600,
                        color: AppColors.navyBright,
                      ),
                    ),
                    Icon(
                      Icons.chevron_right_rounded,
                      size: 16,
                      color: AppColors.navyBright,
                    ),
                  ],
                ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _SummaryFigure(label: 'Clínicas', value: '$clinics'),
              _SummaryFigure(
                label: 'Cobertura',
                value: coverage == null ? '—' : '${(coverage! * 100).round()}%',
              ),
              _SummaryFigure(label: 'Pedidos no mês', value: '$orders'),
            ],
          ),
        ],
      ),
    );

    if (manager == null) return card;
    return InkWell(
      borderRadius: BorderRadius.circular(14),
      // On a drill-down the roster already belongs to one person, so the header
      // is the natural place to reach *their* numbers — the rows below are
      // their reps, and none of them leads here.
      onTap: () => SubjectDashboardRoute(
        subjectUserId: manager!.id,
        subjectName: manager!.name,
        subjectRole: 'MANAGER',
      ).push(context),
      child: card,
    );
  }
}

class _SummaryFigure extends StatelessWidget {
  const _SummaryFigure({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: AppColors.gray900,
              letterSpacing: -0.4,
            ),
          ),
          const SizedBox(height: 1),
          Text(
            label,
            style: const TextStyle(fontSize: 11, color: AppColors.gray500),
          ),
        ],
      ),
    );
  }
}

/// An exception report, not a roster entry — so it reads as a notice rather
/// than as the first person on the team.
class _ExceptionBand extends StatelessWidget {
  const _ExceptionBand({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.amber.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.amber.withValues(alpha: 0.25)),
        ),
        child: const Row(
          children: [
            Icon(
              Icons.report_problem_outlined,
              size: 16,
              color: AppColors.amber,
            ),
            SizedBox(width: 10),
            Expanded(
              child: Text(
                'Representantes sem território',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppColors.gray900,
                ),
              ),
            ),
            Icon(
              Icons.chevron_right_rounded,
              size: 16,
              color: AppColors.gray500,
            ),
          ],
        ),
      ),
    );
  }
}

class _SearchField extends StatelessWidget {
  const _SearchField({required this.value, required this.onChanged});

  final String value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 38,
      child: TextField(
        onChanged: onChanged,
        style: const TextStyle(fontSize: 13.5),
        decoration: InputDecoration(
          isDense: true,
          hintText: 'Buscar pessoa ou território',
          hintStyle: const TextStyle(fontSize: 13, color: AppColors.gray500),
          prefixIcon: const Icon(
            Icons.search_rounded,
            size: 17,
            color: AppColors.gray500,
          ),
          prefixIconConstraints: const BoxConstraints(minWidth: 34),
          filled: true,
          fillColor: Colors.white,
          contentPadding: const EdgeInsets.symmetric(vertical: 9),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: AppColors.surfaceSecondary),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: AppColors.surfaceSecondary),
          ),
        ),
      ),
    );
  }
}

/// One control instead of seven chips.
///
/// The chips took a full scrolling row to say something the roster is not
/// mainly about: order. Now that every row shows its figures whatever the sort,
/// the sort is a preference, and a preference belongs behind a button.
class _SortButton extends StatelessWidget {
  const _SortButton({
    required this.sortBy,
    required this.order,
    required this.onSort,
    required this.isManagerRoster,
  });

  final String sortBy;
  final String order;
  final void Function(String sortBy, String order) onSort;
  final bool isManagerRoster;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(10),
      onTap: () => _open(context),
      child: Container(
        height: 38,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.surfaceSecondary),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              order == 'asc'
                  ? Icons.arrow_upward_rounded
                  : Icons.arrow_downward_rounded,
              size: 15,
              color: AppColors.navyBright,
            ),
            const SizedBox(width: 6),
            Text(
              _sortLabels[sortBy] ?? 'Nome',
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: AppColors.gray900,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _open(BuildContext context) async {
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(20, 16, 20, 8),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'Ordenar por',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppColors.gray900,
                  ),
                ),
              ),
            ),
            for (final entry in _sortOptions(isManagerRoster: isManagerRoster))
              ListTile(
                dense: true,
                title: Text(
                  entry.value,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: sortBy == entry.key
                        ? FontWeight.w700
                        : FontWeight.w500,
                    color: AppColors.gray900,
                  ),
                ),
                // The active row shows which way it currently runs, and tapping
                // it flips that. A different row starts ascending.
                trailing: sortBy == entry.key
                    ? Icon(
                        order == 'asc'
                            ? Icons.arrow_upward_rounded
                            : Icons.arrow_downward_rounded,
                        size: 17,
                        color: AppColors.navyBright,
                      )
                    : null,
                onTap: () {
                  onSort(
                    entry.key,
                    sortBy == entry.key && order == 'asc' ? 'desc' : 'asc',
                  );
                  Navigator.of(sheetContext).pop();
                },
              ),
          ],
        ),
      ),
    );
  }
}

/// A search that matched nobody, said plainly.
class _NoSearchMatch extends StatelessWidget {
  const _NoSearchMatch({required this.term});

  final String term;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 48),
      child: Text(
        'Ninguém nesta equipe corresponde a "$term".',
        textAlign: TextAlign.center,
        style: const TextStyle(fontSize: 13.5, color: AppColors.gray500),
      ),
    );
  }
}

class _MemberTile extends StatelessWidget {
  const _MemberTile({
    required this.member,
    required this.sortBy,
    required this.peakClinics,
    required this.isManagerRoster,
    required this.viaManagerId,
  });

  final TeamMember member;
  final String sortBy;

  /// The largest clinic count in the roster, so a row can draw its share of it.
  ///
  /// A bare "447" says nothing about whether that is a lot. Scaling to the
  /// leader turns the number into a comparison, which is the question anyone
  /// looking at a team list is actually asking. It tracks clínicas rather than
  /// the sort so the bar means one fixed thing.
  final double peakClinics;

  final bool isManagerRoster;

  /// Spec 0015 R2: on a drill-down the rows belong to that manager, and the
  /// profile carries the context so its Desempenho reads the same population.
  final int? viaManagerId;

  /// Built to match `ClinicRow` in Explorar rather than as a bare `ListTile`:
  /// the same bordered row, 44px rounded avatar, 15/w600 title and icon-led
  /// 11px meta. Two lists of people in one app should not look like they came
  /// from different products.
  @override
  Widget build(BuildContext context) {
    final territories = member.territories.map((t) => t.name).join(' · ');
    final metrics = member.metrics;

    return InkWell(
      // One destination per row, always the same one: this person's profile.
      // The manager row used to open a *different* roster, which made "tap a
      // person" mean two things depending on who you were. The team is now a
      // card inside the profile, so the second control is gone too.
      onTap: () => TeamMemberProfileRoute(
        userId: member.userId,
        memberName: member.displayName,
        viaManagerId: viaManagerId,
      ).push(context),
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
                  if (territories.isNotEmpty) ...[
                    const SizedBox(height: 3),
                    _MemberMeta(icon: Icons.layers_rounded, text: territories),
                  ],
                  const SizedBox(height: 8),
                  if (metrics == null)
                    const Text(
                      'sem números nesta linha',
                      style: TextStyle(fontSize: 11, color: AppColors.gray500),
                    )
                  else ...[
                    Row(
                      children: [
                        _RowFigure(
                          label: 'Clínicas',
                          value: '${metrics.assignedClinics}',
                          emphasised: sortBy == 'assigned-clinics',
                        ),
                        _RowFigure(
                          label: 'Cobertura',
                          value: _percent(metrics.coveragePercent),
                          emphasised: sortBy == 'coverage',
                        ),
                        _RowFigure(
                          label: 'Pedidos',
                          value: '${metrics.ordersMonth}',
                          emphasised: sortBy == 'orders-month',
                        ),
                        // Cadastro only when it is what you sorted by: three
                        // figures fit a phone row, four crowd it, and this one
                        // is the least asked for.
                        if (sortBy == 'cadastro-completion')
                          _RowFigure(
                            label: 'Cadastro',
                            value: _percent(metrics.cadastroPercent),
                            emphasised: true,
                          ),
                        // The two sorts the roster cannot compute per row. They
                        // appear only while they are the sort, because that is
                        // the only time they were calculated at all.
                        if (!_rowMetricSorts.contains(sortBy) &&
                            sortBy != 'name')
                          _RowFigure(
                            label: _sortLabels[sortBy] ?? '',
                            value: _formatMetric(sortBy, member.metricValue),
                            emphasised: true,
                          ),
                      ],
                    ),
                    const SizedBox(height: 7),
                    _ShareBar(
                      value: metrics.assignedClinics.toDouble(),
                      peak: peakClinics,
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 8),
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

  /// `—` for a percentage that has no denominator. Rendering 0% would report a
  /// person with no clinics as covering none of them.
  static String _percent(double? value) =>
      value == null ? '—' : '${(value * 100).round()}%';

  /// `—` for a value the API could not calculate. Rendering 0 would put a
  /// person at the bottom of a leaderboard for having no data.
  static String _formatMetric(String sortBy, double? value) {
    if (value == null) return '—';
    if (_percentSorts.contains(sortBy)) return '${(value * 100).round()}%';
    return '${value.round()}';
  }
}

/// One figure in a roster row.
///
/// The sorted one is emphasised rather than being the only one shown: you keep
/// the column you asked for without losing the two you did not.
class _RowFigure extends StatelessWidget {
  const _RowFigure({
    required this.label,
    required this.value,
    required this.emphasised,
  });

  final String label;
  final String value;
  final bool emphasised;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.2,
              color: emphasised ? AppColors.navyBright : AppColors.gray900,
            ),
          ),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 10.5,
              fontWeight: emphasised ? FontWeight.w600 : FontWeight.w400,
              color: emphasised ? AppColors.navyBright : AppColors.gray500,
            ),
          ),
        ],
      ),
    );
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

/// One person's clinics as a share of the roster's largest.
///
/// Scaled to the leader rather than to a fixed ceiling: a clinic count has no
/// natural maximum, so the only honest reading is relative — and relative is
/// also the question people bring to a team list.
class _ShareBar extends StatelessWidget {
  const _ShareBar({required this.value, required this.peak});

  final double value;
  final double peak;

  @override
  Widget build(BuildContext context) {
    final fraction = peak <= 0 ? 0.0 : (value / peak).clamp(0.0, 1.0);

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
