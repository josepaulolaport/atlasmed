import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/core/user/role_capability_providers.dart';
import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_metrics.dart';
import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_scope_args.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/providers/dashboard_provider.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/widgets/cpf_warning_card.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/widgets/dashboard_filter_bar.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/widgets/dashboard_metric_card.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/widgets/dashboard_territory_card.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/widgets/purchase_status_donut_card.dart';
import 'package:atlasmed_mobile_app/features/territories/presentation/widgets/vertical_selector.dart';
import 'package:atlasmed_mobile_app/repository/repository_flutter.dart';
import 'package:atlasmed_mobile_app/features/capture/presentation/today_appointments_card.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:atlasmed_mobile_app/shared/widgets/app_shell.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/router/routes.dart';

/// Desempenho — one screen, three entry points, three scopes (spec 0014 §2).
///
/// [subjectUserId] is set when a manager or admin opens someone's "Ver
/// desempenho" from their profile. Everything else is identical: same screen,
/// same metrics, same filters — which is why the spec has no nested dashboard
/// segments.
class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({
    super.key,
    this.subjectUserId,
    this.withinManagerId,
    this.subjectName,
    this.subjectRole,
  });

  final int? subjectUserId;

  /// Spec 0015 R2 — the team this subject was reached through, so the numbers
  /// match the roster row that opened this screen.
  final int? withinManagerId;
  final String? subjectName;

  /// The subject's role, when the screen was opened from a roster that knew it.
  ///
  /// Needed because "Clínicas não atribuídas" is a question about *zones*, and
  /// whether the screen may ask it depends on whose numbers these are, not on
  /// who is looking. An admin viewing a rep must not see that card: every clinic
  /// in a rep's denominator is assigned to them by definition, so the answer is
  /// always 0 — which is why the API refuses it rather than returning a
  /// reassuring zero (spec 0014 §4).
  final String? subjectRole;

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _ensureVerticalSelected();
    });
  }

  /// A linha is mandatory (spec 0014 §3), so the screen picks the user's first
  /// one rather than rendering an "all linhas" state that has no meaning.
  Future<void> _ensureVerticalSelected() async {
    final options = await ref.read(dashboardVerticalOptionsProvider.future);
    if (!mounted || options.isEmpty) return;
    final current = ref.read(dashboardSelectedVerticalIdProvider);
    if (current != null && options.any((o) => o.id == current)) return;
    ref.read(dashboardSelectedVerticalIdProvider.notifier).state =
        options.first.id;
  }

  Future<void> _onRefresh() async {
    ref.invalidate(dashboardVerticalOptionsProvider);
    // Rebuilding the scope object rebuilds every metric family member, so each
    // card refetches on its own request.
    final filters = ref.read(dashboardFiltersProvider);
    ref.read(dashboardFiltersProvider.notifier).state = filters?.copyWith();
    await _ensureVerticalSelected();
  }

  @override
  Widget build(BuildContext context) {
    final optionsAsync = ref.watch(dashboardVerticalOptionsProvider);
    final selectedVerticalId = ref.watch(dashboardSelectedVerticalIdProvider);
    final scope = ref.watch(
      dashboardScopeArgsProvider(
        DashboardSubjectKey(
          subjectUserId: widget.subjectUserId,
          withinManagerId: widget.withinManagerId,
        ),
      ),
    );
    // Clínicas não atribuídas is a manager question: a rep holds no zones, so
    // the API refuses it rather than answering a reassuring 0.
    //
    // It turns on the *subject*, not the viewer. Reading the viewer's role here
    // meant an admin opening a rep's Desempenho still rendered the card, and
    // the 403 it earned took the whole screen down rather than one tile.
    //
    // A subject whose role we were not told is treated as ineligible: the
    // screen is reachable by deep link, and hiding a card an admin could have
    // seen is a smaller failure than crashing on one they could not.
    final role = ref.watch(currentUserRoleProvider);
    final canSeeUnassigned = widget.subjectUserId == null
        ? (role != null && role != UserRoleName.rep)
        : (widget.subjectRole != null &&
              widget.subjectRole!.toUpperCase() != 'REP');

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AtlasAppBar(
        page: widget.subjectName == null
            ? 'Desempenho'
            : 'Desempenho · ${widget.subjectName}',
      ),
      body: RefreshIndicator(
        onRefresh: _onRefresh,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            optionsAsync.maybeWhen(
              data: (options) {
                if (options.length < 2) return const SizedBox.shrink();
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: VerticalSelector(
                    verticals: options,
                    selectedVerticalId: selectedVerticalId,
                    // Spec 0014 §3: never "todas" — two linhas in one number is
                    // meaningless, so the union option does not exist here.
                    allowAll: false,
                    onChanged: (id) {
                      if (id == null) return;
                      ref
                              .read(
                                dashboardSelectedVerticalIdProvider.notifier,
                              )
                              .state =
                          id;
                    },
                  ),
                );
              },
              orElse: () => const SizedBox.shrink(),
            ),
            if (scope == null)
              const Padding(
                padding: EdgeInsets.only(top: 80),
                child: Center(child: CircularProgressIndicator()),
              )
            else ...[
              DashboardFilterBar(scope: scope),
              const SizedBox(height: 12),
              // Above the donut: it is the only card here asking the rep to do
              // something, and it renders nothing when there is nothing to do.
              _CpfWarningSection(scope: scope),
              // What is left of today, and the press that records it. Above
              // the charts because this is the only card here about the next
              // hour rather than the last quarter, and it renders nothing when
              // the day is done.
              const TodayAppointmentsCard(),
              const SizedBox(height: 12),
              // The two cards that were already here keep the top of the
              // screen: this is the view reps open every day, and spec 0014
              // added metrics to it rather than replacing what they read first.
              _DonutSection(scope: scope),
              const SizedBox(height: 12),
              _TerritorySection(scope: scope),
              const SizedBox(height: 12),
              _MetricGrid(scope: scope, canSeeUnassigned: canSeeUnassigned),
            ],
          ],
        ),
      ),
    );
  }
}

class _MetricGrid extends ConsumerWidget {
  const _MetricGrid({required this.scope, required this.canSeeUnassigned});

  final DashboardScopeArgs scope;
  final bool canSeeUnassigned;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cards = <Widget>[
      DashboardMetricCard<DashboardCountMetric>(
        title: 'Clínicas atribuídas',
        repository: ref.watch(assignedClinicsMetricProvider(scope)),
        onTap: () => _openBreakdown(context, 'assigned-clinics', scope),
        builder: (context, value) => MetricValue(value: '${value.value}'),
      ),
      DashboardMetricCard<DashboardRatioMetric>(
        title: 'Cobertura',
        repository: ref.watch(coverageMetricProvider(scope)),
        onTap: () => _openBreakdown(context, 'coverage', scope),
        builder: (context, value) => MetricValue(
          value: formatPercent(value.percent),
          caption: '${value.numerator} de ${value.denominator} já compraram',
        ),
      ),
      DashboardMetricCard<DashboardRatioMetric>(
        title: 'Cadastro completo',
        repository: ref.watch(cadastroCompletionMetricProvider(scope)),
        onTap: () => _openBreakdown(context, 'cadastro-completion', scope),
        builder: (context, value) => MetricValue(
          value: formatPercent(value.percent),
          caption: '${value.numerator} de ${value.denominator} regularizadas',
        ),
      ),
      if (canSeeUnassigned)
        DashboardMetricCard<DashboardCountMetric>(
          title: 'Clínicas não atribuídas',
          repository: ref.watch(unassignedClinicsMetricProvider(scope)),
          onTap: () => _openBreakdown(context, 'unassigned-clinics', scope),
          builder: (context, value) => MetricValue(
            value: '${value.value}',
            caption: 'sem representante',
            color: value.value > 0 ? const Color(0xFFb45309) : null,
          ),
        ),
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        const spacing = 12.0;
        final width = (constraints.maxWidth - spacing) / 2;
        return Wrap(
          spacing: spacing,
          runSpacing: spacing,
          children: [
            for (final card in cards) SizedBox(width: width, child: card),
          ],
        );
      },
    );
  }
}

class _DonutSection extends ConsumerWidget {
  const _DonutSection({required this.scope});

  final DashboardScopeArgs scope;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return RepositoryBuilder(
      repository: ref.watch(purchaseBucketsMetricProvider(scope)),
      builder: (context, buckets, repo) {
        if (buckets == null) {
          return const SizedBox(
            height: 200,
            child: Center(child: CircularProgressIndicator()),
          );
        }
        return PurchaseStatusDonutCard(
          data: buckets,
          onBucketTap: (bucket) => _openBreakdown(context, switch (bucket) {
            'active' => 'bucket-active',
            'inactive' => 'bucket-inactive',
            _ => 'bucket-never-bought',
          }, scope),
        );
      },
    );
  }
}

/// Renders nothing at all while loading or on failure — an empty slot, not a
/// spinner. A warning that has not arrived is indistinguishable from no warning
/// to the rep, and a skeleton above the donut would shift the whole screen down
/// on every load for the majority of scopes that have nothing pending.
class _CpfWarningSection extends ConsumerWidget {
  const _CpfWarningSection({required this.scope});

  final DashboardScopeArgs scope;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return RepositoryBuilder(
      repository: ref.watch(cpfIssuesMetricProvider(scope)),
      builder: (context, issues, repo) {
        if (issues == null || issues.isClear) return const SizedBox.shrink();
        return Column(
          children: [
            CpfWarningCard(
              issues: issues,
              // Through the same breakdown every other card uses, so the list
              // is scoped exactly like the count that opened it.
              //
              // It first went to the shared Explorar list with only the linha
              // attached, and that list scopes a manager by rep assignment
              // while this count scopes them by zone — so a manager saw "1 sem
              // CPF" open onto "Nenhum resultado". Both screens looked right
              // alone; only tapping one from the other showed it.
              onTapStatus: (cpfStatus) => _openBreakdown(
                context,
                cpfStatus == 'missing' ? 'cpf-missing' : 'cpf-invalid',
                scope,
              ),
            ),
            const SizedBox(height: 12),
          ],
        );
      },
    );
  }
}

class _TerritorySection extends ConsumerWidget {
  const _TerritorySection({required this.scope});

  final DashboardScopeArgs scope;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return RepositoryBuilder(
      repository: ref.watch(dashboardTerritoryProvider(scope)),
      builder: (context, territory, repo) {
        if (territory == null) return const SizedBox.shrink();
        return RepositoryBuilder(
          repository: ref.watch(coverageMetricProvider(scope)),
          builder: (context, coverage, _) => DashboardTerritoryCard(
            data: territory,
            coveragePercent: coverage?.percent == null
                ? null
                : (coverage!.percent! * 100).round(),
          ),
        );
      },
    );
  }
}

void _openBreakdown(
  BuildContext context,
  String metric,
  DashboardScopeArgs scope,
) {
  MetricClinicsRoute(
    metric: metric,
    verticalId: scope.verticalId,
    subjectUserId: scope.subjectUserId,
    // Comma-separated in the URL: the breakdown must answer for the same
    // population the card counted, so every filter travels with it.
    unitTypeIds: scope.unitTypeIds.join(','),
    managerIds: scope.managerIds.join(','),
    repIds: scope.repIds.join(','),
    stateIds: scope.stateIds.join(','),
    municipalityIds: scope.municipalityIds.join(','),
  ).push(context);
}
