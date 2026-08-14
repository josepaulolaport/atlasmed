import 'dart:async';

import 'package:atlasmed_mobile_app/core/state/dispose_safe_state_notifier.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment.dart';
import 'package:atlasmed_mobile_app/core/user/vertical_scope_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/facility_entry.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_recurrence.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/clinic_providers.dart';
import 'package:atlasmed_mobile_app/features/location/data/location_service.dart';
import 'package:atlasmed_mobile_app/features/location/presentation/providers/location_session_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Which slice of the clinic list a Desempenho card opens.
///
/// One provider serves every drill-down rather than one per card. The fetching
/// here — paging, debounced search, GPS revalidation, generation guards against
/// a stale response overwriting a newer one — is 150 lines that were already
/// right; a second copy for CPF would have been a second place for them to go
/// wrong, and only one of the two would get the next fix.
///
/// Exactly one of [bucket] and [cpfStatus] is set. They are separate fields
/// rather than one tagged string because they mean different things to the API
/// and are sent as different parameters.
class FacilityDrillDownArgs {
  const FacilityDrillDownArgs({this.bucket, this.cpfStatus, this.verticalId})
    : assert(
        (bucket == null) != (cpfStatus == null),
        'a drill-down is one slice: pass a bucket or a cpfStatus, never both',
      );

  /// Desempenho purchase bucket: `active` | `inactive` | `neverBought`.
  final String? bucket;

  /// CPF problem: `missing` | `invalid`.
  final String? cpfStatus;

  final int? verticalId;

  @override
  bool operator ==(Object other) =>
      other is FacilityDrillDownArgs &&
      other.bucket == bucket &&
      other.cpfStatus == cpfStatus &&
      other.verticalId == verticalId;

  // This is a Riverpod family key. A field missing here would make two
  // different drill-downs share one cached list — the same failure that made
  // the clinic name sort silently do nothing.
  @override
  int get hashCode => Object.hash(bucket, cpfStatus, verticalId);
}

class FacilityDrillDownState {
  const FacilityDrillDownState({
    this.clinics = const [],
    this.total = 0,
    this.loading = true,
    this.loadingMore = false,
    this.hasMore = true,
    this.query = '',
    this.filters = const {},
    this.sort = 'distance',
    this.visibleCount = 15,
    this.origin,
    this.radiusKm,
  });

  final List<FacilityEntry> clinics;
  final int total;
  final bool loading;
  final bool loadingMore;
  final bool hasMore;
  final String query;
  final Map<String, List<String>> filters;
  final String sort;
  final int visibleCount;
  final DeviceLocation? origin;
  final double? radiusKm;

  FacilityDrillDownState copyWith({
    List<FacilityEntry>? clinics,
    int? total,
    bool? loading,
    bool? loadingMore,
    bool? hasMore,
    String? query,
    Map<String, List<String>>? filters,
    String? sort,
    int? visibleCount,
    DeviceLocation? origin,
    double? radiusKm,
    bool clearRadiusKm = false,
    bool resetVisible = false,
  }) {
    return FacilityDrillDownState(
      clinics: clinics ?? this.clinics,
      total: total ?? this.total,
      loading: loading ?? this.loading,
      loadingMore: loadingMore ?? this.loadingMore,
      hasMore: hasMore ?? this.hasMore,
      query: query ?? this.query,
      filters: filters ?? this.filters,
      sort: sort ?? this.sort,
      visibleCount: resetVisible ? 15 : (visibleCount ?? this.visibleCount),
      origin: origin ?? this.origin,
      radiusKm: clearRadiusKm ? null : (radiusKm ?? this.radiusKm),
    );
  }

  List<FacilityEntry> get visibleClinics =>
      clinics.take(visibleCount).toList(growable: false);

  bool get canLoadMore =>
      visibleCount < clinics.length || (hasMore && !loadingMore);
}

final facilityDrillDownProvider = StateNotifierProvider.autoDispose
    .family<
      FacilityDrillDownNotifier,
      FacilityDrillDownState,
      FacilityDrillDownArgs
    >((ref, args) {
      final notifier = FacilityDrillDownNotifier(ref, args);
      unawaited(notifier.refreshGpsAndList());
      return notifier;
    });

class FacilityDrillDownNotifier extends StateNotifier<FacilityDrillDownState>
    with DisposeSafeStateWrites<FacilityDrillDownState> {
  FacilityDrillDownNotifier(this._ref, this.args)
    : super(const FacilityDrillDownState());

  final Ref _ref;
  final FacilityDrillDownArgs args;

  static const _pageSize = 20;
  static const _searchDebounceDuration = Duration(milliseconds: 350);

  Timer? _searchDebounce;
  int _page = 1;
  int _refreshGeneration = 0;

  DeviceLocation? get _origin =>
      state.origin ?? _ref.read(locationSessionProvider).location;

  PurchaseProfile? get _purchaseProfile {
    final value = state.filters['purchaseProfile']?.first;
    return purchaseProfileFromApi(value);
  }

  int? _purchaseIntervalBound(String key) =>
      int.tryParse(state.filters[key]?.first ?? '');

  ({FacilitySort? sort, SortOrder? order}) get _facilitySort =>
      switch (state.sort) {
        'distance' => (
          sort: _origin == null ? null : FacilitySort.distance,
          order: SortOrder.asc,
        ),
        'name-asc' => (sort: FacilitySort.name, order: SortOrder.asc),
        'name-desc' => (sort: FacilitySort.name, order: SortOrder.desc),
        'purchase-funnel-asc' => (
          sort: FacilitySort.purchaseFunnelStage,
          order: SortOrder.asc,
        ),
        'purchase-funnel-desc' => (
          sort: FacilitySort.purchaseFunnelStage,
          order: SortOrder.desc,
        ),
        'purchase-interval-asc' => (
          sort: FacilitySort.purchaseIntervalDays,
          order: SortOrder.asc,
        ),
        'purchase-interval-desc' => (
          sort: FacilitySort.purchaseIntervalDays,
          order: SortOrder.desc,
        ),
        'last-purchase-asc' => (
          sort: FacilitySort.lastPurchaseDate,
          order: SortOrder.asc,
        ),
        'last-purchase-desc' => (
          sort: FacilitySort.lastPurchaseDate,
          order: SortOrder.desc,
        ),
        _ => (sort: null, order: null),
      };

  Future<void> refreshGpsAndList() async {
    try {
      await _ref
          .read(locationSessionProvider.notifier)
          .revalidate()
          .timeout(const Duration(seconds: 12));
    } on Object {
      // Keep cached origin.
    }

    final location = _ref.read(locationSessionProvider).location;
    if (location != null) {
      state = state.copyWith(origin: location);
    }
    await reload();
  }

  Future<void> reload() async {
    _searchDebounce?.cancel();
    final generation = ++_refreshGeneration;
    state = state.copyWith(loading: true, hasMore: true, resetVisible: true);
    _page = 1;

    await SessionEnvironment.instance.currentValueOrResolve();
    await _fetchPage(page: 1, generation: generation);
    if (generation != _refreshGeneration) return;
    state = state.copyWith(loading: false);
  }

  Future<void> _fetchPage({
    required int page,
    bool append = false,
    int? generation,
  }) async {
    final origin = _origin;
    try {
      final verticalId =
          args.verticalId ??
          await _ref.read(effectiveFacilityVerticalIdProvider.future);
      final facilitySort = _facilitySort;
      final query = ClinicsQuery(
        page: page,
        limit: _pageSize,
        searchQuery: state.query.isNotEmpty ? state.query : null,
        latitude: origin?.latitude,
        longitude: origin?.longitude,
        radiusKm: state.radiusKm,
        purchaseBucket: args.bucket,
        cpfStatus: args.cpfStatus,
        purchaseProfile: _purchaseProfile,
        purchaseIntervalMinDays: _purchaseIntervalBound(
          'purchaseIntervalMinDays',
        ),
        purchaseIntervalMaxDays: _purchaseIntervalBound(
          'purchaseIntervalMaxDays',
        ),
        sort: facilitySort.sort,
        order: facilitySort.order,
        verticalId: verticalId,
      );
      final repo = _ref.read(clinicsRepositoryProvider(query));
      final result = await repo.currentValueOrResolve();
      if (generation != null && generation != _refreshGeneration) return;
      if (result == null) return;

      final items = result.items.map(FacilityEntry.fromDTO).toList();
      state = state.copyWith(
        clinics: append ? [...state.clinics, ...items] : items,
        total: result.pagination.total,
        hasMore: result.pagination.page < result.pagination.totalPages,
      );
      _page = result.pagination.page;
    } catch (_) {
      // Keep current list on transient errors.
    }
  }

  void setQuery(String query) {
    state = state.copyWith(query: query, resetVisible: true);
    _searchDebounce?.cancel();
    _searchDebounce = Timer(_searchDebounceDuration, () {
      unawaited(reload());
    });
  }

  void applyFilters({
    required Map<String, List<String>> filters,
    double? radiusKm,
    bool clearRadius = false,
  }) {
    // Bucket is locked by route — strip status / funnel stages if present.
    final sanitized = Map<String, List<String>>.from(filters)
      ..remove('status')
      ..remove('purchaseFunnelStage')
      ..remove('purchaseBucket');
    state = state.copyWith(
      filters: sanitized,
      radiusKm: radiusKm,
      clearRadiusKm: clearRadius,
      resetVisible: true,
    );
    unawaited(reload());
  }

  void setSort(String sort) {
    state = state.copyWith(sort: sort, resetVisible: true);
    unawaited(reload());
  }

  Future<void> loadMore() async {
    if (state.loadingMore) return;

    // Reveal buffered rows before hitting the network again.
    if (state.visibleCount < state.clinics.length) {
      final nextVisible = state.visibleCount + _pageSize;
      state = state.copyWith(
        visibleCount: nextVisible > state.clinics.length
            ? state.clinics.length
            : nextVisible,
      );
      return;
    }

    if (!state.hasMore) return;
    state = state.copyWith(loadingMore: true);
    final nextPage = _page + 1;
    final generation = _refreshGeneration;
    await _fetchPage(page: nextPage, append: true, generation: generation);
    if (generation != _refreshGeneration) return;
    state = state.copyWith(
      visibleCount: state.clinics.length,
      loadingMore: false,
    );
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    super.dispose();
  }
}
