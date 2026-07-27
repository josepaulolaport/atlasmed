import 'dart:async';
import 'dart:convert';

import 'package:atlasmed_mobile_app/core/user/vertical_scope_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api_types/clinic_api_type.dart'
    as api;
import 'package:atlasmed_mobile_app/features/explore/data/api_types/doctor_api_type.dart';
import 'package:atlasmed_mobile_app/features/explore/data/clinic_detail.dart';
import 'package:atlasmed_mobile_app/features/explore/data/doctor_detail.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/filter_data.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_recurrence.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/doctors_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/professional_notes_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/clinic_visits_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/api_repository_providers.dart';

import 'package:atlasmed_mobile_app/features/explore/data/models/clinic.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/doctor.dart';
import 'package:atlasmed_mobile_app/features/location/data/location_service.dart';
import 'package:atlasmed_mobile_app/features/location/presentation/providers/location_session_provider.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

export 'package:atlasmed_mobile_app/features/location/presentation/providers/location_session_provider.dart'
    show locationServiceProvider;

// ── Helper: parse a single Clinic from a detail endpoint response ──
api.Clinic _parseClinicDetail(String json) {
  final map = jsonDecode(json) as Map<String, dynamic>;
  return api.Clinic.fromMap(map);
}

// ── Clinic detail repository ────────────────────────────────
class _ClinicDetailRepository extends Repository<api.Clinic>
    with SessionEnvironmentMixin<api.Clinic> {
  _ClinicDetailRepository({required String id, String? verticalId})
    : super(
        endpoint: Uri.parse(
          '${AppConfig.apiBaseUrl}/api/v1/facilities/$id'
          '${verticalId == null || verticalId.isEmpty ? '' : '?verticalId=${Uri.encodeQueryComponent(verticalId)}'}',
        ),
        resolveOnCreate: false,
        name: 'ClinicDetailRepository',
      );

  @override
  api.Clinic fromJson(String json) => _parseClinicDetail(json);
}

// ── Doctor detail repository ────────────────────────────────
class DoctorDetailRepository extends Repository<ApiDoctor>
    with SessionEnvironmentMixin<ApiDoctor> {
  DoctorDetailRepository({required String id})
    : super(
        endpoint: Uri.parse('${AppConfig.apiBaseUrl}/api/v1/professionals/$id'),
        resolveOnCreate: false,
        name: 'DoctorDetailRepository',
      );

  @override
  ApiDoctor fromJson(String json) {
    final map = jsonDecode(json) as Map<String, dynamic>;
    return ApiDoctor.fromMap(map);
  }
}

// ── Detail fetch helpers (no Riverpod family; called per request) ──
Future<ClinicDetail> _fetchClinicDetail(String id, {String? verticalId}) async {
  // Mock nearby pins (`near-*` / `:empty`) are disabled on the real API.
  if (id.startsWith('near-') || id.endsWith(':empty')) {
    throw Exception('Clinic not found: $id');
  }

  final repo = _ClinicDetailRepository(id: id, verticalId: verticalId);
  try {
    // Always hit the network — currentValueOrResolve() returns hydrated cache
    // and skips refresh, which leaves stale admin fields after NC approve.
    // (Constructor hydratate may still race dispose; BaseRepository.emit ignores
    // closed controllers.)
    final apiClinic = await repo.refresh();
    if (apiClinic == null) {
      throw Exception('Clinic not found: $id');
    }
    // Map DTO Clinic → ClinicDetail. Prefer API values; Phase-1 mock-fill
    // gaps (list/detail DTO still omits number/complement/CEP) so Dados
    // administrativos can show Estado / Cidade / CEP / Endereço.
    String? nonEmpty(String? value) {
      final trimmed = value?.trim();
      return trimmed == null || trimmed.isEmpty ? null : trimmed;
    }

    // Prefer API values as-is. Do not invent fake address/phone when missing.
    // commercial/conformity come from the facility DTO; purchase stays mocked.
    return ClinicDetail(
      id: apiClinic.id,
      name: apiClinic.name,
      city: nonEmpty(apiClinic.city) ?? '',
      state: nonEmpty(apiClinic.state),
      neighborhood: nonEmpty(apiClinic.neighborhood) ?? '',
      distanceKm: apiClinic.distanceKm ?? 0,
      status: ClinicStatus.active,
      lastVisitDays: null,
      doctorCount: apiClinic.professionalCount,
      isPriority: false,
      products: [],
      phone: nonEmpty(apiClinic.phone),
      whatsapp: nonEmpty(apiClinic.whatsapp),
      consultantName: apiClinic.consultantName,
      consultantSince: apiClinic.consultantSince,
      managerName: apiClinic.managerName,
      territoryName: apiClinic.territoryName,
      email: nonEmpty(apiClinic.email),
      billingEmail: nonEmpty(apiClinic.billingEmail),
      website: nonEmpty(apiClinic.website),
      responsibleDoctor: nonEmpty(apiClinic.responsibleName),
      openingHours: nonEmpty(apiClinic.openingHours),
      registeredSince: apiClinic.registeredSince ?? apiClinic.createdAt,
      streetAddress: nonEmpty(apiClinic.streetAddress),
      streetNumber: nonEmpty(apiClinic.streetNumber),
      addressComplement: nonEmpty(apiClinic.addressComplement),
      postalCode: nonEmpty(apiClinic.postalCode),
      lat: apiClinic.lat,
      lng: apiClinic.lng,
      taxIdType: apiClinic.taxIdType,
      cnpj: apiClinic.cnpj,
      cpf: apiClinic.cpf,
      commercialStatus: apiClinic.commercialStatus,
      conformityStatus: apiClinic.conformityStatus,
      purchaseRecurrence: apiClinic.purchaseRecurrence,
    );
  } finally {
    repo.dispose();
  }
}

/// Maps a professional API profile into the doctor detail UI model.
DoctorDetail doctorDetailFromApi(ApiDoctor apiDoctor) {
  final name = apiDoctor.displayName;
  final nameParts = name.split(' ');
  final initials = nameParts.length >= 2
      ? '${nameParts.first[0]}${nameParts.last[0]}'
      : name.isNotEmpty
      ? name[0]
      : '?';
  return DoctorDetail(
    id: apiDoctor.id,
    name: name,
    initials: initials.toUpperCase(),
    specialty: apiDoctor.specialty ?? '',
    crm: apiDoctor.crm,
    role: apiDoctor.specialty ?? '',
    distanceKm: apiDoctor.distanceKm ?? 0,
    phone: apiDoctor.phone,
    email: apiDoctor.email,
    whatsapp: null,
    // ISO `YYYY-MM-DD` for edit round-trip; UI formats for display.
    birthday: apiDoctor.birthDate == null
        ? null
        : '${apiDoctor.birthDate!.year.toString().padLeft(4, '0')}-'
              '${apiDoctor.birthDate!.month.toString().padLeft(2, '0')}-'
              '${apiDoctor.birthDate!.day.toString().padLeft(2, '0')}',
    faculty: null,
    residency: null,
    team: apiDoctor.favoriteTeam,
    interests: apiDoctor.hobbies,
    language: apiDoctor.languages,
    statusLabel: '',
    relationshipLabel: '',
    notes: const [],
    clinics: apiDoctor.facilities
        .map((f) => DoctorClinic(id: f.id, name: f.name, role: '', days: ''))
        .toList(growable: false),
    gallery: const [],
    signals: const [],
    prescribing: const [],
    visits: const [],
  );
}

// ── Clinic detail provider ──────────────────────────────────
final clinicDetailProvider = FutureProvider.family<ClinicDetail, String>((
  ref,
  id,
) async {
  final verticalId = await ref.watch(
    effectiveFacilityVerticalIdProvider.future,
  );
  return _fetchClinicDetail(id, verticalId: verticalId);
});

// ── Doctor detail provider ──────────────────────────────────
final doctorProvider = Provider.autoDispose
    .family<DoctorDetailRepository, String>((ref, id) {
      final repository = DoctorDetailRepository(id: id);
      ref.onDispose(repository.dispose);
      return repository;
    });

// ── Professional notes ──────────────────────────────────────
final professionalNotesRepositoryProvider = Provider.autoDispose
    .family<ProfessionalNotesRepository, String>((ref, professionalId) {
      final repository = ProfessionalNotesRepository(professionalId);
      ref.onDispose(repository.dispose);
      return repository;
    });

// ── Clinic visits ──────────────────────────────────────────
final clinicVisitsRepositoryProvider =
    Provider.family<ClinicVisitsRepository, String>((ref, facilityId) {
      final repository = ClinicVisitsRepository(facilityId);
      ref.onDispose(repository.dispose);
      return repository;
    });

final clinicVisitsProvider = FutureProvider.family<List<ClinicVisit>, String>((
  ref,
  facilityId,
) {
  return ref
      .watch(clinicVisitsRepositoryProvider(facilityId))
      .currentValueOrResolve()
      .then((visits) => visits ?? const []);
});

// ── Explore state ───────────────────────────────────────────
class ExploreState {
  final List<Clinic> clinics;
  final List<Doctor> doctors;

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
    List<Clinic>? clinics,
    List<Doctor>? doctors,
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
  List<Clinic> get filteredClinics {
    var list = List<Clinic>.from(clinics);

    switch (sort) {
      case 'name-asc':
        list.sort((a, b) => a.name.compareTo(b.name));
      case 'distance':
        list.sort(
          (a, b) => _compareNullableDistance(a.distanceKm, b.distanceKm),
        );
      case 'oldest-visit':
        list.sort((a, b) {
          final aDays = a.lastVisitDays ?? 999999;
          final bDays = b.lastVisitDays ?? 999999;
          return bDays.compareTo(aDays);
        });
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

  List<Doctor> get filteredDoctors {
    var list = List<Doctor>.from(doctors);

    switch (sort) {
      case 'name-asc':
        list.sort((a, b) => a.name.compareTo(b.name));
      case 'distance':
        list.sort(
          (a, b) => _compareNullableDistance(a.distanceKm, b.distanceKm),
        );
      case 'last-contact':
        list.sort(
          (a, b) => _compareNullableDistance(b.distanceKm, a.distanceKm),
        );
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

  Future<void> refreshAfterClinicUpdate(api.Clinic clinic) async {
    final mapped = Clinic.fromApi(clinic);
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
        final items = result.items.map(Clinic.fromApi).toList();
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
    final repo = DoctorsRepository(
      page: p,
      limit: 20,
      searchQuery: state.query.isNotEmpty ? state.query : null,
      latitude: origin?.latitude,
      longitude: origin?.longitude,
      // Spec: doctors never send radiusKm
      radiusKm: null,
      specialty: _commaJoin(state.filters['specialties']),
      resolveOnCreate: false,
    );
    try {
      final result = await repo.currentValueOrResolve();
      if (generation != null && generation != _refreshGeneration) return;
      if (result != null) {
        final items = result.items.map(Doctor.fromApi).toList();
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
      repo.dispose();
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
