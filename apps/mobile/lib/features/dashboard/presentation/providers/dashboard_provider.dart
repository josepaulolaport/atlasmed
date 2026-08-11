import 'package:atlasmed_mobile_app/core/user/vertical_scope_provider.dart';
import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_metrics.dart';
import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_scope_args.dart';
import 'package:atlasmed_mobile_app/features/dashboard/data/repositories/dashboard_repository.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/business_vertical.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The linha the screen is showing.
///
/// Never null once options resolve, and never "todas": spec 0014 §3 forbids
/// mixing two linhas in one number, so the selector has no union option and the
/// ADMIN special case that produced "Brasil · visão geral" is gone.
final dashboardSelectedVerticalIdProvider = StateProvider<int?>((ref) => null);

/// The active filter set (spec 0014 §5), applied uniformly to every metric.
final dashboardFiltersProvider = StateProvider<DashboardScopeArgs?>(
  (ref) => null,
);

final dashboardVerticalOptionsProvider = FutureProvider<List<BusinessVertical>>(
  (ref) => ref.watch(currentUserFacilityVerticalOptionsProvider.future),
);

/// The scope every metric request shares. Null until a linha is known — no
/// metric may be fetched before then, because there is no correct answer.
///
/// Keyed by the subject (spec 0014 §2: null is the viewer's own Desempenho,
/// otherwise the person whose profile it was opened from). It is a family and
/// not a `StateProvider` the subject screen writes to, because the subject
/// screen is *pushed over* the dashboard tab: a global would still hold the
/// other person's id after the push was popped, and the viewer's own tab would
/// go on showing that person's numbers under the heading "Desempenho".
final dashboardScopeArgsProvider = Provider.family<DashboardScopeArgs?, int?>((
  ref,
  subjectUserId,
) {
  final verticalId = ref.watch(dashboardSelectedVerticalIdProvider);
  if (verticalId == null) return null;

  final filters = ref.watch(dashboardFiltersProvider);
  return DashboardScopeArgs(
    verticalId: verticalId,
    subjectUserId: subjectUserId,
    unitTypeIds: filters?.unitTypeIds ?? const [],
    managerIds: filters?.managerIds ?? const [],
    repIds: filters?.repIds ?? const [],
    stateIds: filters?.stateIds ?? const [],
    municipalityIds: filters?.municipalityIds ?? const [],
  );
});

/// One autodisposing repository per (metric, scope) so a filter change starts a
/// fresh request and the old one is torn down rather than raced.
AutoDisposeProviderFamily<Repository<T>, DashboardScopeArgs> _metricFamily<T>(
  Repository<T> Function(DashboardScopeArgs args) build,
) {
  return Provider.autoDispose.family<Repository<T>, DashboardScopeArgs>((
    ref,
    args,
  ) {
    final repository = build(args);
    ref.onDispose(repository.dispose);
    return repository;
  });
}

final assignedClinicsMetricProvider = _metricFamily<DashboardCountMetric>(
  assignedClinicsRepository,
);
final coverageMetricProvider = _metricFamily<DashboardRatioMetric>(
  coverageRepository,
);
final purchaseBucketsMetricProvider = _metricFamily<DashboardBuckets>(
  purchaseBucketsRepository,
);
final cadastroCompletionMetricProvider = _metricFamily<DashboardRatioMetric>(
  cadastroCompletionRepository,
);
final ordersMetricProvider = _metricFamily<DashboardOrdersMetric>(
  ordersRepository,
);
final penetrationMetricProvider = _metricFamily<DashboardPenetrationMetric>(
  penetrationRepository,
);
final unassignedClinicsMetricProvider = _metricFamily<DashboardCountMetric>(
  unassignedClinicsRepository,
);
final dashboardTerritoryProvider = _metricFamily<DashboardTerritory>(
  territoryRepository,
);

class MetricClinicsArgs {
  const MetricClinicsArgs({
    required this.metric,
    required this.scope,
    this.page = 1,
    this.limit = 25,
  });

  final String metric;
  final DashboardScopeArgs scope;
  final int page;
  final int limit;

  @override
  bool operator ==(Object other) =>
      other is MetricClinicsArgs &&
      other.metric == metric &&
      other.scope == scope &&
      other.page == page &&
      other.limit == limit;

  @override
  int get hashCode => Object.hash(metric, scope, page, limit);
}

final metricClinicsProvider = Provider.autoDispose
    .family<Repository<DashboardClinicPage>, MetricClinicsArgs>((ref, args) {
      final repository = metricClinicsRepository(
        metric: args.metric,
        args: args.scope,
        page: args.page,
        limit: args.limit,
      );
      ref.onDispose(repository.dispose);
      return repository;
    });

/// The options every drawer can offer, for the scope currently on screen.
///
/// Keyed by the whole scope, so changing any filter starts a fresh request and
/// the lists re-narrow — that is the entire mechanism behind the progressive
/// drawers (spec 0014 §5).
final filterOptionsProvider = _metricFamily<DashboardFilterOptions>(
  filterOptionsRepository,
);
