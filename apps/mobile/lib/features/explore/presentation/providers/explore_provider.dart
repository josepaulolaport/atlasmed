import 'dart:async';
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api_types/clinic_api_type.dart'
    as api;
import 'package:atlasmed_mobile_app/features/explore/data/api_types/doctor_api_type.dart';
import 'package:atlasmed_mobile_app/features/explore/data/clinic_detail.dart';
import 'package:atlasmed_mobile_app/features/explore/data/doctor_detail.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_mock.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/filter_data.dart';
import 'package:atlasmed_mobile_app/features/explore/data/professional_note.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/clinics_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/doctors_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/professional_notes_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/professionals_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/clinic_visits_repository.dart';

import 'package:atlasmed_mobile_app/features/explore/data/models/clinic.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/doctor.dart';
import 'package:atlasmed_mobile_app/features/location/data/location_service.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

// ── Helper: parse a single Clinic from a detail endpoint response ──
api.Clinic _parseClinicDetail(String json) {
  final map = jsonDecode(json) as Map<String, dynamic>;
  return api.Clinic.fromMap(map);
}

// ── Clinic detail repository ────────────────────────────────
class _ClinicDetailRepository extends Repository<api.Clinic>
    with SessionEnvironmentMixin<api.Clinic> {
  _ClinicDetailRepository({required String id})
    : super(
        endpoint: Uri.parse('${AppConfig.apiBaseUrl}/api/v1/facilities/$id'),
        resolveOnCreate: false,
        name: 'ClinicDetailRepository',
      );

  @override
  api.Clinic fromJson(String json) => _parseClinicDetail(json);
}

// ── Doctor detail repository ────────────────────────────────
class _DoctorDetailRepository extends Repository<ApiDoctor>
    with SessionEnvironmentMixin<ApiDoctor> {
  _DoctorDetailRepository({required String id})
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
Future<ClinicDetail> _fetchClinicDetail(String id) async {
  // Phase-1 nearby-map pins use mock ids (`near-*`). Serve local mock detail
  // so "Ir para página da clínica" works offline / without a real facility.
  final nearbyMock = mockClinicDetailForNearbyId(id);
  if (nearbyMock != null) return nearbyMock;

  final repo = _ClinicDetailRepository(id: id);
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
    );
  } finally {
    repo.dispose();
  }
}

String _formatBirthDatePtBr(String? isoDate) {
  if (isoDate == null || isoDate.isEmpty) return '';
  final parts = isoDate.split('-');
  if (parts.length != 3) return isoDate;
  return '${parts[2]}/${parts[1]}/${parts[0]}';
}

DoctorDetail _mapApiDoctorToDetail(ApiDoctor apiDoctor) {
  final name = apiDoctor.displayName;
  final nameParts = name
      .split(RegExp(r'\s+'))
      .where((p) => p.isNotEmpty)
      .toList();
  final initials = nameParts.length >= 2
      ? '${nameParts.first[0]}${nameParts.last[0]}'
      : name.isNotEmpty
      ? name[0]
      : '?';
  final clinics = apiDoctor.facilities.isNotEmpty
      ? apiDoctor.facilities
            .asMap()
            .entries
            .map(
              (e) => DoctorClinic(
                id: e.value.id,
                name: e.value.name,
                role: '',
                days: '',
                isMain: e.key == 0,
              ),
            )
            .toList(growable: false)
      : apiDoctor.facilityIds
            .asMap()
            .entries
            .map(
              (e) => DoctorClinic(
                id: e.value,
                name: e.value,
                role: '',
                days: '',
                isMain: e.key == 0,
              ),
            )
            .toList(growable: false);

  return DoctorDetail(
    id: apiDoctor.id,
    name: name,
    firstName: apiDoctor.firstName,
    lastName: apiDoctor.lastName,
    initials: initials.toUpperCase(),
    hue: 0,
    specialty: apiDoctor.specialty ?? '',
    crm: apiDoctor.crm,
    crmNumber: apiDoctor.crmNumber,
    crmState: apiDoctor.crmState,
    role: apiDoctor.specialty ?? '',
    distanceKm: apiDoctor.distanceKm ?? 0,
    phone: apiDoctor.mobilePhone,
    email: apiDoctor.email,
    whatsapp: apiDoctor.whatsappNumber,
    birthday: () {
      final formatted = _formatBirthDatePtBr(apiDoctor.birthDate);
      return formatted.isEmpty ? null : formatted;
    }(),
    faculty: apiDoctor.faculty,
    residency: apiDoctor.residency,
    team: apiDoctor.favoriteTeam,
    interests: apiDoctor.hobbies,
    language: apiDoctor.languages,
    statusLabel: '',
    relationshipLabel: '',
    notes: const [],
    clinics: clinics,
    gallery: const [],
    signals: const [],
    prescribing: const [],
    visits: const [],
  );
}

Future<DoctorDetail> _fetchDoctorDetail(String id) async {
  final repo = _DoctorDetailRepository(id: id);
  try {
    final apiDoctor = await repo.refresh();
    if (apiDoctor == null) {
      throw Exception('Doctor not found: $id');
    }
    return _mapApiDoctorToDetail(apiDoctor);
  } finally {
    repo.dispose();
  }
}

// ── Location service provider ───────────────────────────────
final locationServiceProvider = Provider<LocationService>((ref) {
  return LocationService(GeolocatorLocationPlatform());
});

// ── Clinic detail provider ──────────────────────────────────
final clinicDetailProvider = FutureProvider.family<ClinicDetail, String>((
  ref,
  id,
) {
  return _fetchClinicDetail(id);
});

// ── Doctor detail provider ──────────────────────────────────
final doctorDetailProvider = FutureProvider.family<DoctorDetail, String>((
  ref,
  id,
) {
  return _fetchDoctorDetail(id);
});

// ── Professional notes ──────────────────────────────────────
final professionalNotesRepositoryProvider =
    Provider.family<ProfessionalNotesRepository, String>((ref, professionalId) {
      return ProfessionalNotesRepository(professionalId);
    });

final professionalNotesProvider =
    FutureProvider.family<List<ProfessionalNote>, String>((
      ref,
      professionalId,
    ) {
      return ref
          .watch(professionalNotesRepositoryProvider(professionalId))
          .currentValueOrResolve()
          .then((notes) => notes ?? const []);
    });

final professionalsRepositoryProvider =
    Provider.family<ProfessionalsRepository, String>((ref, professionalId) {
      final repository = ProfessionalsRepository(professionalId);
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
  final bool loading;
  final bool loadingMore;
  final String activeTab; // 'clinic' | 'doctor'
  final String query;
  final Map<String, List<String>>
  filters; // {status: [...], products: [...], specialties: [...]}
  final String sort;
  final int visibleCount;
  final DeviceLocation? proximityOrigin;
  final LocationFailure? proximityFailure;
  final bool requestingProximity;

  const ExploreState({
    this.clinics = const [],
    this.doctors = const [],
    this.loading = true,
    this.loadingMore = false,
    this.activeTab = 'clinic',
    this.query = '',
    this.filters = const {},
    this.sort = 'distance',
    this.visibleCount = 15,
    this.proximityOrigin,
    this.proximityFailure,
    this.requestingProximity = false,
  });

  ExploreState copyWith({
    List<Clinic>? clinics,
    List<Doctor>? doctors,
    bool? loading,
    bool? loadingMore,
    String? activeTab,
    String? query,
    Map<String, List<String>>? filters,
    String? sort,
    int? visibleCount,
    DeviceLocation? proximityOrigin,
    LocationFailure? proximityFailure,
    bool? requestingProximity,
    bool clearProximityOrigin = false,
    bool clearProximityFailure = false,
    bool resetVisible = false,
  }) {
    return ExploreState(
      clinics: clinics ?? this.clinics,
      doctors: doctors ?? this.doctors,
      loading: loading ?? this.loading,
      loadingMore: loadingMore ?? this.loadingMore,
      activeTab: activeTab ?? this.activeTab,
      query: query ?? this.query,
      filters: filters ?? this.filters,
      sort: sort ?? this.sort,
      visibleCount: resetVisible ? 15 : (visibleCount ?? this.visibleCount),
      proximityOrigin: clearProximityOrigin
          ? null
          : (proximityOrigin ?? this.proximityOrigin),
      proximityFailure: clearProximityFailure
          ? null
          : (proximityFailure ?? this.proximityFailure),
      requestingProximity: requestingProximity ?? this.requestingProximity,
    );
  }

  // ── Computed properties ───────────────────────────────────

  /// Clinic list with client-side sort only.
  /// Search / status / products come from the API (Meilisearch when `query`
  /// is non-empty); do not re-filter locally or results are capped to the
  /// already-loaded page.
  List<Clinic> get filteredClinics {
    var list = List<Clinic>.from(clinics);

    // Sort – client-side (API does not support all sort variants)
    switch (sort) {
      case 'name-asc':
        list.sort((a, b) => a.name.compareTo(b.name));
        break;
      case 'distance':
        list.sort((a, b) => a.distanceKm.compareTo(b.distanceKm));
        break;
      case 'oldest-visit':
        list.sort((a, b) {
          final aDays = a.lastVisitDays ?? 999999;
          final bDays = b.lastVisitDays ?? 999999;
          return bDays.compareTo(aDays);
        });
        break;
    }

    return list;
  }

  /// Doctor list with client-side sort only.
  /// Search / specialty come from the API (Meilisearch when `query` is
  /// non-empty); do not re-filter locally.
  List<Doctor> get filteredDoctors {
    var list = List<Doctor>.from(doctors);

    // Sort – client-side
    switch (sort) {
      case 'name-asc':
        list.sort((a, b) => a.name.compareTo(b.name));
        break;
      case 'distance':
        list.sort((a, b) => a.distanceKm.compareTo(b.distanceKm));
        break;
      case 'last-contact':
        list.sort((a, b) => b.distanceKm.compareTo(a.distanceKm));
        break;
    }

    return list;
  }
}

// ── Explore notifier ────────────────────────────────────────
class ExploreNotifier extends StateNotifier<ExploreState> {
  final LocationService _locationService;

  ExploreNotifier(this._locationService) : super(const ExploreState());

  int _clinicPage = 1;
  int _doctorPage = 1;
  bool _clinicHasMore = true;
  bool _doctorHasMore = true;
  Timer? _searchDebounce;
  int _refreshGeneration = 0;

  static const _searchDebounceDuration = Duration(milliseconds: 350);

  @override
  void dispose() {
    _searchDebounce?.cancel();
    super.dispose();
  }

  // ── Helpers ───────────────────────────────────────────────

  String? _commaJoin(List<String>? values) {
    if (values == null || values.isEmpty) return null;
    return values.join(',');
  }

  // ── Data fetching ─────────────────────────────────────────

  Future<void> loadData() async {
    _searchDebounce?.cancel();
    final generation = ++_refreshGeneration;
    state = state.copyWith(loading: true, resetVisible: true);
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

  /// Fetch a page of clinics from the API with current search/filter/proximity
  /// params. When [append] is true the results are appended to the existing list.
  Future<void> _fetchClinicsPage({
    int? page,
    bool append = false,
    int? generation,
  }) async {
    final p = page ?? _clinicPage;
    final repo = ClinicsRepository(
      page: p,
      limit: 20,
      searchQuery: state.query.isNotEmpty ? state.query : null,
      latitude: state.proximityOrigin?.latitude,
      longitude: state.proximityOrigin?.longitude,
      radiusKm: state.proximityOrigin != null ? defaultProximityRadiusKm : null,
      commercialStatus: _commaJoin(state.filters['status']),
      productIds: _commaJoin(state.filters['products']),
      resolveOnCreate: false,
    );
    try {
      final result = await repo.currentValueOrResolve();
      if (generation != null && generation != _refreshGeneration) return;
      if (result != null) {
        final items = result.items.map(Clinic.fromApi).toList();
        if (append) {
          state = state.copyWith(clinics: [...state.clinics, ...items]);
        } else {
          state = state.copyWith(clinics: items);
        }
        _clinicPage = result.pagination.page;
        _clinicHasMore = result.pagination.page < result.pagination.totalPages;
      }
    } finally {
      repo.dispose();
    }
  }

  /// Fetch a page of doctors from the API with current search/filter/proximity
  /// params. When [append] is true the results are appended to the existing list.
  Future<void> _fetchDoctorsPage({
    int? page,
    bool append = false,
    int? generation,
  }) async {
    final p = page ?? _doctorPage;
    final repo = DoctorsRepository(
      page: p,
      limit: 20,
      searchQuery: state.query.isNotEmpty ? state.query : null,
      latitude: state.proximityOrigin?.latitude,
      longitude: state.proximityOrigin?.longitude,
      radiusKm: state.proximityOrigin != null ? defaultProximityRadiusKm : null,
      specialty: _commaJoin(state.filters['specialties']),
      resolveOnCreate: false,
    );
    try {
      final result = await repo.currentValueOrResolve();
      if (generation != null && generation != _refreshGeneration) return;
      if (result != null) {
        final items = result.items.map(Doctor.fromApi).toList();
        if (append) {
          state = state.copyWith(doctors: [...state.doctors, ...items]);
        } else {
          state = state.copyWith(doctors: items);
        }
        _doctorPage = result.pagination.page;
        _doctorHasMore = result.pagination.page < result.pagination.totalPages;
      }
    } finally {
      repo.dispose();
    }
  }

  /// Reload current tab's data from page 1 with the latest params.
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
      // Silently handle API errors during refresh – the existing list stays
      // visible (or empty if first load).
    }
    if (generation != _refreshGeneration) return;
    state = state.copyWith(loading: false);
  }

  // ── Public methods ────────────────────────────────────────

  Future<void> enableProximity() async {
    state = state.copyWith(
      requestingProximity: true,
      clearProximityFailure: true,
    );
    final result = await _locationService.requestCurrentLocation();

    switch (result) {
      case LocationAvailable(:final location):
        state = state.copyWith(
          proximityOrigin: location,
          requestingProximity: false,
          clearProximityFailure: true,
          resetVisible: true,
        );
        await _refreshCurrentTab();
      case LocationUnavailable(:final failure):
        state = state.copyWith(
          requestingProximity: false,
          proximityFailure: failure,
          clearProximityOrigin: true,
        );
    }
  }

  void disableProximity() {
    state = state.copyWith(
      clearProximityOrigin: true,
      clearProximityFailure: true,
      requestingProximity: false,
      resetVisible: true,
    );
    unawaited(_refreshCurrentTab());
  }

  void setTab(String tab) {
    if (tab == state.activeTab) return;
    state = state.copyWith(activeTab: tab, resetVisible: true);
    // Apply current search/filters to the newly visible list.
    unawaited(_refreshCurrentTab());
  }

  void setQuery(String query) {
    state = state.copyWith(query: query, resetVisible: true);
    _searchDebounce?.cancel();
    _searchDebounce = Timer(_searchDebounceDuration, () {
      unawaited(_refreshCurrentTab());
    });
  }

  void setFilters(Map<String, List<String>> filters) {
    state = state.copyWith(filters: filters, resetVisible: true);
    unawaited(_refreshCurrentTab());
  }

  void setSort(String sort) {
    state = state.copyWith(sort: sort, resetVisible: true);
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
  final locationService = ref.watch(locationServiceProvider);
  return ExploreNotifier(locationService);
});
