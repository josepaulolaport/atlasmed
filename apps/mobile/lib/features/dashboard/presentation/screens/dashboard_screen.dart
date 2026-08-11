import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/core/user/role_capability_providers.dart';
import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_metrics.dart';
import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_scope_args.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/providers/dashboard_provider.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/widgets/dashboard_filter_bar.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/widgets/dashboard_metric_card.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/widgets/dashboard_territory_card.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/widgets/purchase_status_donut_card.dart';
import 'package:atlasmed_mobile_app/features/territories/presentation/widgets/vertical_selector.dart';
import 'package:atlasmed_mobile_app/repository/repository_flutter.dart';
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
  const DashboardScreen({super.key, this.subjectUserId, this.subjectName});

  final int? subjectUserId;
  final String? subjectName;

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
    final scope = ref.watch(dashboardScopeArgsProvider(widget.subjectUserId));
    // Clínicas não atribuídas is a manager question: a rep holds no zones, so
    // the API refuses it for them rather than answering a reassuring 0.
    final role = ref.watch(currentUserRoleProvider);
    final canSeeUnassigned = role != null && role != UserRoleName.rep;

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
              _MetricGrid(scope: scope, canSeeUnassigned: canSeeUnassigned),
              const SizedBox(height: 12),
              _PenetrationCard(scope: scope),
              const SizedBox(height: 12),
              _DonutSection(scope: scope),
              const SizedBox(height: 12),
              _TerritorySection(scope: scope),
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
      DashboardMetricCard<DashboardOrdersMetric>(
        title: 'Pedidos',
        repository: ref.watch(ordersMetricProvider(scope)),
        builder: (context, value) => MetricValue(
          value: '${value.month}',
          caption: 'no mês · ${value.week} nos últimos 7 dias',
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

/// Penetração média, one row per metric of the linha.
///
/// Not blended into a single percentage: a linha may define several metrics and
/// they measure different units, so adding them would be arithmetic on
/// incompatible quantities (spec 0013 §4.2).
class _PenetrationCard extends ConsumerWidget {
  const _PenetrationCard({required this.scope});

  final DashboardScopeArgs scope;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return DashboardMetricCard<DashboardPenetrationMetric>(
      title: 'Penetração média',
      repository: ref.watch(penetrationMetricProvider(scope)),
      builder: (context, value) {
        if (value.metrics.isEmpty) {
          return const MetricValue(
            value: null,
            caption: 'nenhuma métrica definida para esta linha',
          );
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            for (final entry in value.metrics)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(
                      child: MetricValue(
                        value: entry.meanShare == null
                            ? null
                            : formatPercent(entry.meanShare),
                        caption: entry.label,
                      ),
                    ),
                    Text(
                      // The gap between these two numbers is the point: a mean
                      // over 3 of 200 clinics is a real number about very
                      // little, and the card has to say so.
                      '${entry.clinicsCounted} de ${value.denominator} clínicas',
                      style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFF6b7280),
                      ),
                    ),
                  ],
                ),
              ),
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
    unitTypeId: scope.unitTypeId,
    managerId: scope.managerId,
    repId: scope.repId,
    stateId: scope.stateId,
    municipalityId: scope.municipalityId,
  ).push(context);
}
