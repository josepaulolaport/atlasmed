import 'dart:async';

import 'package:atlasmed_mobile_app/core/state/dispose_safe_state_notifier.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api/facility_api.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_bucket.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/clinic_providers.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/doctor_list_providers.dart';
import 'package:atlasmed_mobile_app/features/location/data/location_service.dart';
import 'package:atlasmed_mobile_app/features/location/presentation/providers/location_session_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class ExploreState {
  const ExploreState({
    this.activeTab = 'clinic',
    this.query = '',
    this.searchQuery = '',
    this.filters = const {},
    this.sort = 'distance',
    this.origin,
    this.radiusKm,
  });

  final String activeTab;

  /// Text currently shown in the search input.
  final String query;

  /// Debounced text used to create repository query keys.
  final String searchQuery;

  /// Clinic: `status`, `products`, purchase recurrence filters.
  /// Doctor: `specialties`.
  final Map<String, List<String>> filters;
  final String sort;
  final DeviceLocation? origin;
  final double? radiusKm;

  ExploreState copyWith({
    String? activeTab,
    String? query,
    String? searchQuery,
    Map<String, List<String>>? filters,
    String? sort,
    DeviceLocation? origin,
    double? radiusKm,
    bool clearOrigin = false,
    bool clearRadiusKm = false,
  }) {
    return ExploreState(
      activeTab: activeTab ?? this.activeTab,
      query: query ?? this.query,
      searchQuery: searchQuery ?? this.searchQuery,
      filters: filters ?? this.filters,
      sort: sort ?? this.sort,
      origin: clearOrigin ? null : (origin ?? this.origin),
      radiusKm: clearRadiusKm ? null : (radiusKm ?? this.radiusKm),
    );
  }
}

class ExploreNotifier extends StateNotifier<ExploreState>
    with DisposeSafeStateWrites<ExploreState> {
  ExploreNotifier(this._ref) : super(const ExploreState()) {
    final location = _ref.read(locationSessionProvider).location;
    if (location != null) state = state.copyWith(origin: location);
  }

  final Ref _ref;
  Timer? _searchDebounce;

  static const _searchDebounceDuration = Duration(milliseconds: 350);
  static const meaningfulMoveMeters = 150.0;

  @override
  void dispose() {
    _searchDebounce?.cancel();
    super.dispose();
  }

  void syncOrigin(
    DeviceLocation location, {
    bool refetch = true,
    bool requireMeaningfulMove = false,
  }) {
    final previous = state.origin;
    if (requireMeaningfulMove && previous != null) {
      final moved = LocationSessionNotifier.distanceMeters(previous, location);
      if (moved != null && moved < meaningfulMoveMeters) return;
    }
    state = state.copyWith(origin: location);
    if (refetch) _invalidatePages();
  }

  Future<void> refreshGpsAndList() async {
    try {
      await _ref
          .read(locationSessionProvider.notifier)
          .revalidate()
          .timeout(const Duration(seconds: 12));
    } on Object {
      // Keep cached origin if soft GPS refresh fails/times out.
    }

    final location = _ref.read(locationSessionProvider).location;
    if (location != null) state = state.copyWith(origin: location);
    _invalidatePages();
  }

  Future<void> refreshAfterClinicUpdate(FacilityDTO _) async {
    _ref.invalidate(clinicsPageProvider);
    _ref.invalidate(clinicsRepositoryProvider);
  }

  void setTab(String tab) {
    if (tab == state.activeTab) return;
    state = state.copyWith(activeTab: tab);
  }

  void setQuery(String query) {
    state = state.copyWith(query: query);
    _searchDebounce?.cancel();
    _searchDebounce = Timer(_searchDebounceDuration, () {
      state = state.copyWith(searchQuery: query.trim());
    });
  }

  void applyFilters({
    required Map<String, List<String>> filters,
    double? radiusKm,
    bool clearRadius = false,
  }) {
    state = state.copyWith(
      filters: filters,
      radiusKm: radiusKm,
      clearRadiusKm: clearRadius,
    );
  }

  /// Open Explorar clinic tab with a Desempenho purchase-status bucket.
  void applyPurchaseBucket(String bucket) {
    state = state.copyWith(
      activeTab: 'clinic',
      filters: {
        ...state.filters,
        'status': const <String>[],
        'purchaseFunnelStage': const <String>[],
        'purchaseBucket': PurchaseBucketFilter.values.contains(bucket)
            ? <String>[bucket]
            : const <String>[],
      },
    );
  }

  void setSort(String sort) {
    state = state.copyWith(sort: sort);
  }

  void _invalidatePages() {
    _ref.invalidate(clinicsPageProvider);
    _ref.invalidate(clinicsRepositoryProvider);
    _ref.invalidate(doctorsPageProvider);
    _ref.invalidate(doctorsRepositoryProvider);
  }
}

final exploreProvider = StateNotifierProvider<ExploreNotifier, ExploreState>((
  ref,
) {
  final notifier = ExploreNotifier(ref);
  ref.listen<LocationSessionState>(locationSessionProvider, (previous, next) {
    final location = next.location;
    if (location == null || previous?.location == location) return;
    notifier.syncOrigin(location, requireMeaningfulMove: true);
  });
  return notifier;
});
