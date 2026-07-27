import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api/facility_api.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_recurrence.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/facility_entry.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/professional_entry.dart';
import 'package:atlasmed_mobile_app/core/user/vertical_scope_provider.dart';

import 'package:atlasmed_mobile_app/features/explore/presentation/providers/clinic_providers.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/doctor_list_providers.dart';
import 'package:atlasmed_mobile_app/features/location/data/location_service.dart';
import 'package:atlasmed_mobile_app/features/location/presentation/providers/location_session_provider.dart';

export 'package:atlasmed_mobile_app/features/location/presentation/providers/location_session_provider.dart'
    show locationServiceProvider;

// ── Explore state ───────────────────────────────────────────
class ExploreState {
  final List<FacilityEntry> clinics;
  final List<ProfessionalEntry> doctors;

  /// API pagination totals (not loaded-page length).
  final int clinicTotal;
  final int doctorTotal;
  final bool loading;
  final bool loadingMore;
  final String activeTab; // 'clinic' | 'doctor'
  final String query;

  /// Clinic: `status` (single commercialStatus), `products` (product UUIDs).
  /// Doctor: `specialties`.
  final Map<String, List<String>> filters;
  final String sort;
  final int visibleCount;

  /// From [locationSessionProvider] — always set once past the hard gate.
  final DeviceLocation? origin;

  /// Clinics only; null = no radius limit.
  final double? radiusKm;

  const ExploreState({
    this.clinics = const [],
    this.doctors = const [],
    this.clinicTotal = 0,
    this.doctorTotal = 0,
    this.loading = true,
    this.loadingMore = false,
    this.activeTab = 'clinic',
    this.query = '',
    this.filters = const {},
    this.sort = 'distance',
    this.visibleCount = 15,
    this.origin,
    this.radiusKm,
  });

  ExploreState copyWith({
    List<FacilityEntry>? clinics,
    List<ProfessionalEntry>? doctors,
    int? clinicTotal,
    int? doctorTotal,
    bool? loading,
    bool? loadingMore,
    String? activeTab,
    String? query,
    Map<String, List<String>>? filters,
    String? sort,
    int? visibleCount,
    DeviceLocation? origin,
    double? radiusKm,
    bool clearOrigin = false,
    bool clearRadiusKm = false,
    bool resetVisible = false,
  }) {
    return ExploreState(
      clinics: clinics ?? this.clinics,
      doctors: doctors ?? this.doctors,
      clinicTotal: clinicTotal ?? this.clinicTotal,
      doctorTotal: doctorTotal ?? this.doctorTotal,
      loading: loading ?? this.loading,
      loadingMore: loadingMore ?? this.loadingMore,
      activeTab: activeTab ?? this.activeTab,
      query: query ?? this.query,
      filters: filters ?? this.filters,
      sort: sort ?? this.sort,
      visibleCount: resetVisible ? 15 : (visibleCount ?? this.visibleCount),
      origin: clearOrigin ? null : (origin ?? this.origin),
      radiusKm: clearRadiusKm ? null : (radiusKm ?? this.radiusKm),
    );
  }

  static int _compareNullableDistance(double? a, double? b) {
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    return a.compareTo(b);
  }

  /// Clinic list with client-side sort only (API already distance-orders when
  /// coords + sort=distance are sent).
  List<FacilityEntry> get filteredClinics {
    var list = List<FacilityEntry>.from(clinics);

    switch (sort) {
      case 'name-asc':
        list.sort((a, b) => a.name.compareTo(b.name));
      case 'distance':
        list.sort(
          (a, b) => _compareNullableDistance(a.distanceKm, b.distanceKm),
        );
      case 'oldest-visit':
        // lastVisitDays não existe mais em FacilityEntry — ordena por nome.
        list.sort((a, b) => a.name.compareTo(b.name));
      case 'purchase-funnel-asc':
      case 'purchase-funnel-desc':
      case 'purchase-interval-asc':
      case 'purchase-interval-desc':
      case 'last-purchase-asc':
      case 'last-purchase-desc':
        // These are canonical server sorts; preserve API pagination order.
        break;
      default:
        break;
    }

    return list;
  }

  List<ProfessionalEntry> get filteredDoctors {
    var list = List<ProfessionalEntry>.from(doctors);

    switch (sort) {
      case 'name-asc':
      case 'name-desc':
        // Server handles name sort; preserve API pagination order.
        break;
      default:
        break;
    }

    return list;
  }
}

// ── Explore notifier ────────────────────────────────────────
class ExploreNotifier extends StateNotifier<ExploreState> {
  final Ref _ref;

  ExploreNotifier(this._ref) : super(const ExploreState()) {
    final session = _ref.read(locationSessionProvider);
    if (session.location != null) {
      state = state.copyWith(origin: session.location);
    }
  }

  int _clinicPage = 1;
  int _doctorPage = 1;
  bool _clinicHasMore = true;
  bool _doctorHasMore = true;
  Timer? _searchDebounce;
  int _refreshGeneration = 0;

  static const _searchDebounceDuration = Duration(milliseconds: 350);
  static const meaningfulMoveMeters = 150.0;

  Future<void> refreshAfterClinicUpdate(FacilityDTO dto) async {
    final mapped = FacilityEntry.fromDTO(dto);
    state = state.copyWith(
      clinics: [
        for (final item in state.clinics)
          if (item.id == mapped.id) mapped else item,
      ],
    );
    _clinicPage = 1;
    _clinicHasMore = true;
    await _fetchClinicsPage(page: 1);
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    super.dispose();
  }

  String? _commaJoin(List<String>? values) {
    if (values == null || values.isEmpty) return null;
    return values.join(',');
  }

  /// Single commercial status (API accepts one string).
  String? get _commercialStatus {
    final list = state.filters['status'];
    if (list == null || list.isEmpty) return null;
    return list.first;
  }

  List<PurchaseFunnelStage> get _purchaseFunnelStages =>
      (state.filters['purchaseFunnelStage'] ?? const [])
          .map(purchaseFunnelStageFromApi)
          .whereType<PurchaseFunnelStage>()
          .toList(growable: false);

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

  ({FacilitySort? sort, SortOrder? order}) get _doctorSort =>
      switch (state.sort) {
        'name-asc' => (sort: FacilitySort.name, order: SortOrder.asc),
        'name-desc' => (sort: FacilitySort.name, order: SortOrder.desc),
        _ => (sort: null, order: null),
      };

  DeviceLocation? get _origin =>
      state.origin ?? _ref.read(locationSessionProvider).location;

  void syncOrigin(
    DeviceLocation location, {
    bool refetch = true,
    bool requireMeaningfulMove = false,
  }) {
    final previous = state.origin;
    state = state.copyWith(origin: location, resetVisible: refetch);
    if (!refetch) return;
    if (requireMeaningfulMove && previous != null) {
      final moved = LocationSessionNotifier.distanceMeters(previous, location);
      if (moved != null && moved < meaningfulMoveMeters) return;
    }
    unawaited(_refreshCurrentTab());
  }

  /// Refresh GPS (soft), then always load the list. Never leave [loading]
  /// stuck true if GPS hangs or coordinates are unchanged.
  Future<void> refreshGpsAndList() async {
    try {
      await _ref
          .read(locationSessionProvider.notifier)
          .revalidate()
          .timeout(const Duration(seconds: 12));
    } on Object {
      // Keep cached origin if soft GPS refresh fails/times out.
    }

    if (!_ref.read(locationSessionProvider).isUsable) {
      state = state.copyWith(loading: false);
      return;
    }

    final location = _ref.read(locationSessionProvider).location;
    if (location != null) {
      state = state.copyWith(origin: location);
    }
    await loadData();
  }

  Future<void> loadData() async {
    _searchDebounce?.cancel();
    final generation = ++_refreshGeneration;
    final origin = _origin;
    state = state.copyWith(loading: true, resetVisible: true, origin: origin);
    _clinicPage = 1;
    _doctorPage = 1;
    _clinicHasMore = true;
    _doctorHasMore = true;

    await Future.wait([
      _fetchClinicsPage(page: 1, generation: generation),
      _fetchDoctorsPage(page: 1, generation: generation),
    ]);

    if (generation != _refreshGeneration) return;
    state = state.copyWith(loading: false);
  }

  Future<void> _fetchClinicsPage({
    int? page,
    bool append = false,
    int? generation,
  }) async {
    final p = page ?? _clinicPage;
    final origin = _origin;
    final verticalId = await _ref.read(
      effectiveFacilityVerticalIdProvider.future,
    );
    final facilitySort = _facilitySort;
    final query = ClinicsQuery(
      page: p,
      limit: 20,
      searchQuery: state.query.isNotEmpty ? state.query : null,
      latitude: origin?.latitude,
      longitude: origin?.longitude,
      radiusKm: state.radiusKm,
      commercialStatus: _commercialStatus,
      productIds: _commaJoin(state.filters['products']),
      purchaseFunnelStages: _purchaseFunnelStages,
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
    try {
      final result = await repo.currentValueOrResolve();
      if (generation != null && generation != _refreshGeneration) return;
      if (result != null) {
        final items = result.items.map(FacilityEntry.fromDTO).toList();
        if (append) {
          state = state.copyWith(
            clinics: [...state.clinics, ...items],
            clinicTotal: result.pagination.total,
          );
        } else {
          state = state.copyWith(
            clinics: items,
            clinicTotal: result.pagination.total,
          );
        }
        _clinicPage = result.pagination.page;
        _clinicHasMore = result.pagination.page < result.pagination.totalPages;
      }
    } finally {
      // The Riverpod repository provider owns this repository's lifecycle.
    }
  }

  Future<void> _fetchDoctorsPage({
    int? page,
    bool append = false,
    int? generation,
  }) async {
    final p = page ?? _doctorPage;
    final origin = _origin;
    final doctorSort = _doctorSort;
    final query = DoctorsQuery(
      page: p,
      limit: 20,
      searchQuery: state.query.isNotEmpty ? state.query : null,
      latitude: origin?.latitude,
      longitude: origin?.longitude,
      radiusKm: null,
      specialty: _commaJoin(state.filters['specialties']),
      sort: doctorSort.sort,
      order: doctorSort.order,
    );
    final repo = _ref.read(doctorsRepositoryProvider(query));
    try {
      final result = await repo.currentValueOrResolve();
      if (generation != null && generation != _refreshGeneration) return;
      if (result != null) {
        final items = result.items.map(ProfessionalEntry.fromDTO).toList();
        if (append) {
          state = state.copyWith(
            doctors: [...state.doctors, ...items],
            doctorTotal: result.pagination.total,
          );
        } else {
          state = state.copyWith(
            doctors: items,
            doctorTotal: result.pagination.total,
          );
        }
        _doctorPage = result.pagination.page;
        _doctorHasMore = result.pagination.page < result.pagination.totalPages;
      }
    } finally {
      // The Riverpod repository provider owns this repository's lifecycle.
    }
  }

  Future<void> _refreshCurrentTab() async {
    final generation = ++_refreshGeneration;
    state = state.copyWith(loading: true);
    try {
      if (state.activeTab == 'clinic') {
        _clinicPage = 1;
        await _fetchClinicsPage(page: 1, generation: generation);
      } else {
        _doctorPage = 1;
        await _fetchDoctorsPage(page: 1, generation: generation);
      }
    } catch (_) {
      // Keep existing list on transient API errors.
    }
    if (generation != _refreshGeneration) return;
    state = state.copyWith(loading: false);
  }

  void setTab(String tab) {
    if (tab == state.activeTab) return;
    state = state.copyWith(activeTab: tab, resetVisible: true);
    unawaited(_refreshCurrentTab());
  }

  void setQuery(String query) {
    state = state.copyWith(query: query, resetVisible: true);
    _searchDebounce?.cancel();
    _searchDebounce = Timer(_searchDebounceDuration, () {
      unawaited(_refreshCurrentTab());
    });
  }

  /// Apply clinic/doctor filters and optional clinic radius (null = no limit).
  void applyFilters({
    required Map<String, List<String>> filters,
    double? radiusKm,
    bool clearRadius = false,
  }) {
    state = state.copyWith(
      filters: filters,
      radiusKm: radiusKm,
      clearRadiusKm: clearRadius,
      resetVisible: true,
    );
    unawaited(_refreshCurrentTab());
  }

  void setSort(String sort) {
    state = state.copyWith(sort: sort, resetVisible: true);
    unawaited(_refreshCurrentTab());
  }

  Future<void> loadMore() async {
    if (state.loadingMore) return;
    state = state.copyWith(loadingMore: true);

    if (state.activeTab == 'clinic') {
      if (!_clinicHasMore) {
        state = state.copyWith(loadingMore: false);
        return;
      }
      _clinicPage++;
      await _fetchClinicsPage(append: true);
    } else {
      if (!_doctorHasMore) {
        state = state.copyWith(loadingMore: false);
        return;
      }
      _doctorPage++;
      await _fetchDoctorsPage(append: true);
    }

    state = state.copyWith(
      loadingMore: false,
      visibleCount: state.visibleCount + 20,
    );
  }
}

// ── Provider ────────────────────────────────────────────────
final exploreProvider = StateNotifierProvider<ExploreNotifier, ExploreState>((
  ref,
) {
  final notifier = ExploreNotifier(ref);
  ref.listen<LocationSessionState>(locationSessionProvider, (previous, next) {
    final location = next.location;
    if (location == null) return;
    if (previous?.location == location) return;
    // Background GPS watch: only refetch list after a meaningful move.
    notifier.syncOrigin(location, requireMeaningfulMove: true);
  });
  return notifier;
});
