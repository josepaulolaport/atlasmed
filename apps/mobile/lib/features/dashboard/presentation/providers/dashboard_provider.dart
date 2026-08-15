import 'dart:async';

import 'package:atlasmed_mobile_app/core/user/vertical_scope_provider.dart';
import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_metrics.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/facility_entry.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/clinic_sort_option.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_recurrence.dart';
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

/// Who a dashboard is about, and through whose team they were reached.
class DashboardSubjectKey {
  const DashboardSubjectKey({this.subjectUserId, this.withinManagerId});

  final int? subjectUserId;
  final int? withinManagerId;

  @override
  bool operator ==(Object other) =>
      other is DashboardSubjectKey &&
      other.subjectUserId == subjectUserId &&
      other.withinManagerId == withinManagerId;

  @override
  int get hashCode => Object.hash(subjectUserId, withinManagerId);
}

/// The scope every metric request shares. Null until a linha is known — no
/// metric may be fetched before then, because there is no correct answer.
///
/// Keyed by the subject (spec 0014 §2: null is the viewer's own Desempenho,
/// otherwise the person whose profile it was opened from). It is a family and
/// not a `StateProvider` the subject screen writes to, because the subject
/// screen is *pushed over* the dashboard tab: a global would still hold the
/// other person's id after the push was popped, and the viewer's own tab would
/// go on showing that person's numbers under the heading "Desempenho".
///
/// The key carries `withinManagerId` alongside the subject (spec 0015 R2): an
/// admin can open the same rep through two different managers, and those are
/// two different populations, so they must not share a cache entry.
final dashboardScopeArgsProvider =
    Provider.family<DashboardScopeArgs?, DashboardSubjectKey>((ref, key) {
      final verticalId = ref.watch(dashboardSelectedVerticalIdProvider);
      if (verticalId == null) return null;

      final filters = ref.watch(dashboardFiltersProvider);
      return DashboardScopeArgs(
        verticalId: verticalId,
        subjectUserId: key.subjectUserId,
        withinManagerId: key.withinManagerId,
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
final cpfIssuesMetricProvider = _metricFamily<DashboardCpfIssues>(
  cpfIssuesRepository,
);
final cadastroCompletionMetricProvider = _metricFamily<DashboardRatioMetric>(
  cadastroCompletionRepository,
);
final unassignedClinicsMetricProvider = _metricFamily<DashboardCountMetric>(
  unassignedClinicsRepository,
);
final dashboardTerritoryProvider = _metricFamily<DashboardTerritory>(
  territoryRepository,
);

/// The pages of a breakdown loaded so far, as one list.
///
/// The screen used to hold a page number and swap 25 rows for 25 other rows
/// behind "Anterior · Próxima". Nothing else in the app reads that way: Explorar
/// and every clinic surface built on it keep the list and grow it, with skeleton
/// rows where the next page is landing. Same list, so the same behaviour.
class MetricClinicsListState {
  const MetricClinicsListState({
    this.clinics = const [],
    this.total = 0,
    this.page = 0,
    this.query = '',
    this.sort = 'name-asc',
    this.loading = true,
    this.loadingMore = false,
  });

  final List<FacilityEntry> clinics;

  /// How many clinics match — the search included. Not the metric's own count,
  /// which is the card above and does not move because somebody typed.
  final int total;

  /// Highest page fetched; 0 before the first has landed.
  final int page;
  final String query;

  /// A `SortSheet(kind: 'clinic')` key. Defaults to the ordering this list
  /// always had, so opening a breakdown shows what it showed before.
  final String sort;

  final bool loading;
  final bool loadingMore;

  /// Against `total` rather than "the last page came back full", so the footer
  /// skeleton never appears below the final row.
  bool get hasMore => clinics.length < total;

  MetricClinicsListState copyWith({
    List<FacilityEntry>? clinics,
    int? total,
    int? page,
    String? query,
    String? sort,
    bool? loading,
    bool? loadingMore,
  }) {
    return MetricClinicsListState(
      clinics: clinics ?? this.clinics,
      total: total ?? this.total,
      page: page ?? this.page,
      query: query ?? this.query,
      sort: sort ?? this.sort,
      loading: loading ?? this.loading,
      loadingMore: loadingMore ?? this.loadingMore,
    );
  }
}

typedef MetricClinicsFetch =
    Future<DashboardClinicPage?> Function({
      required String metric,
      required DashboardScopeArgs scope,
      required int page,
      required int limit,
      String? search,
      String? sortKey,
    });

Future<DashboardClinicPage?> _fetchMetricClinics({
  required String metric,
  required DashboardScopeArgs scope,
  required int page,
  required int limit,
  String? search,
  String? sortKey,
}) async {
  // The sheet's key, translated once, by the table both lists share. This
  // screen has no origin, so `distance` resolves to null and the request falls
  // back to the server's default ordering rather than asking for a sort the
  // rows cannot support.
  final resolved = clinicSortForKey(sortKey);
  final repository = metricClinicsRepository(
    metric: metric,
    args: scope,
    page: page,
    limit: limit,
    search: search,
    sort: resolved.sort?.apiValue,
    order: resolved.sort == null ? null : resolved.order?.name,
  );
  try {
    return await repository.currentValueOrResolve();
  } finally {
    repository.dispose();
  }
}

class MetricClinicsListNotifier extends StateNotifier<MetricClinicsListState> {
  /// [fetch] is injected so paging can be driven in a widget test without an
  /// HTTP stack — the accumulate-and-append behaviour is the part worth
  /// pinning, and it is invisible from outside a real network.
  MetricClinicsListNotifier({
    required this.metric,
    required this.scope,
    MetricClinicsFetch fetch = _fetchMetricClinics,
  }) : _fetch = fetch,
       super(const MetricClinicsListState()) {
    unawaited(_load(1));
  }

  final String metric;
  final DashboardScopeArgs scope;
  final MetricClinicsFetch _fetch;

  static const pageSize = 25;

  Timer? _debounce;

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> refresh() async {
    state = MetricClinicsListState(query: state.query, sort: state.sort);
    await _load(1);
  }

  /// Re-orders the whole set, not the page on screen.
  ///
  /// Starts over at page 1: the rows already loaded are the first N of the
  /// *old* ordering, and keeping them would put a sorted page under an
  /// unsorted one.
  Future<void> setSort(String key) async {
    if (key == state.sort) return;
    state = state.copyWith(
      sort: key,
      clinics: const [],
      page: 0,
      loading: true,
    );
    await _load(1);
  }

  /// Debounced: every keystroke is a request otherwise, and the answers can
  /// land out of order — the list would settle on whichever query the server
  /// finished last rather than on what is in the box.
  void setQuery(String value) {
    if (value == state.query) return;
    state = state.copyWith(query: value);
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      if (!mounted) return;
      state = state.copyWith(loading: true, clinics: const [], page: 0);
      unawaited(_load(1));
    });
  }

  /// Guarded on [MetricClinicsListState.loadingMore]: the scroll listener fires
  /// on every scroll-end near the bottom, and an unguarded call would append the
  /// same page twice.
  Future<void> loadMore() async {
    if (state.loadingMore || state.loading || !state.hasMore) return;
    state = state.copyWith(loadingMore: true);
    await _load(state.page + 1);
  }

  Future<void> _load(int page) async {
    final requestedQuery = state.query;
    final requestedSort = state.sort;
    final result = await _fetch(
      metric: metric,
      scope: scope,
      page: page,
      limit: pageSize,
      search: requestedQuery,
      sortKey: requestedSort,
    );
    if (!mounted) return;
    // Dropped if the box or the ordering moved on while this was in flight: a
    // slow answer to an old query would otherwise overwrite a fast answer to
    // the current one, and the list would settle on something nobody asked for.
    if (requestedQuery != state.query || requestedSort != state.sort) return;
    if (result == null) {
      state = state.copyWith(loading: false, loadingMore: false);
      return;
    }
    state = state.copyWith(
      clinics: page == 1 ? result.data : [...state.clinics, ...result.data],
      total: result.total,
      page: page,
      loading: false,
      loadingMore: false,
    );
  }
}

class MetricClinicsListArgs {
  const MetricClinicsListArgs({required this.metric, required this.scope});

  final String metric;
  final DashboardScopeArgs scope;

  @override
  bool operator ==(Object other) =>
      other is MetricClinicsListArgs &&
      other.metric == metric &&
      other.scope == scope;

  @override
  int get hashCode => Object.hash(metric, scope);
}

final metricClinicsListProvider = StateNotifierProvider.autoDispose
    .family<
      MetricClinicsListNotifier,
      MetricClinicsListState,
      MetricClinicsListArgs
    >(
      (ref, args) =>
          MetricClinicsListNotifier(metric: args.metric, scope: args.scope),
    );

/// The options every drawer can offer, for the scope currently on screen.
///
/// Keyed by the whole scope, so changing any filter starts a fresh request and
/// the lists re-narrow — that is the entire mechanism behind the progressive
/// drawers (spec 0014 §5).
final filterOptionsProvider = _metricFamily<DashboardFilterOptions>(
  filterOptionsRepository,
);
