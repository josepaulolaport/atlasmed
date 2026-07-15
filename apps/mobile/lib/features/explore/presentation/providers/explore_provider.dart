import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api_types/clinic_api_type.dart' as api;
import 'package:atlasmed_mobile_app/features/explore/data/api_types/doctor_api_type.dart';
import 'package:atlasmed_mobile_app/features/explore/data/clinic_detail.dart';
import 'package:atlasmed_mobile_app/features/explore/data/doctor_detail.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/filter_data.dart';
import 'package:atlasmed_mobile_app/features/explore/data/professional_note.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/clinics_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/doctors_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/professional_notes_repository.dart';
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
  final repo = _ClinicDetailRepository(id: id);
  try {
    final apiClinic = await repo.currentValueOrResolve();
    if (apiClinic == null) {
      throw Exception('Clinic not found: $id');
    }
    // Map DTO Clinic → ClinicDetail
    final cityParts = <String>[
      if (apiClinic.city != null && apiClinic.city!.isNotEmpty) apiClinic.city!,
      if (apiClinic.state != null && apiClinic.state!.isNotEmpty)
        apiClinic.state!,
    ];
    return ClinicDetail(
      id: apiClinic.id,
      name: apiClinic.name,
      city: cityParts.isNotEmpty ? cityParts.join(', ') : '',
      neighborhood: '',
      distanceKm: apiClinic.distanceKm ?? 0,
      status: ClinicStatus.active,
      lastVisitDays: null,
      doctorCount: apiClinic.professionalCount,
      isPriority: false,
      products: [],
      phone: apiClinic.phone,
      email: apiClinic.email,
      website: apiClinic.website,
      streetAddress: apiClinic.streetAddress,
      cnpj: apiClinic.cnpj,
      fieldNotes: null,
    );
  } finally {
    repo.dispose();
  }
}

Future<DoctorDetail> _fetchDoctorDetail(String id) async {
  final repo = _DoctorDetailRepository(id: id);
  try {
    final apiDoctor = await repo.currentValueOrResolve();
    if (apiDoctor == null) {
      throw Exception('Doctor not found: $id');
    }
    final name = apiDoctor.displayName;
    final nameParts = name.split(' ');
    final initials = nameParts.length >= 2
        ? '${nameParts.first[0]}${nameParts.last[0]}'
        : name.isNotEmpty
        ? name[0]
        : '?';
    final crm = apiDoctor.crm;
    return DoctorDetail(
      id: apiDoctor.id,
      name: name,
      initials: initials.toUpperCase(),
      hue: 0,
      specialty: apiDoctor.specialty ?? '',
      crm: crm,
      role: apiDoctor.specialty != null ? '${apiDoctor.specialty}' : '',
      distanceKm: apiDoctor.distanceKm ?? 0,
      phone: null,
      email: null,
      whatsapp: null,
      birthday: null,
      faculty: null,
      residency: null,
      team: null,
      interests: null,
      language: null,
      statusLabel: '',
      relationshipLabel: '',
      notes: const [],
      clinics: const [],
      gallery: const [],
      signals: const [],
      prescribing: const [],
      visits: const [],
    );
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

  /// Filtered clinic list based on query + sort.
  /// Server-side filtering (status, products) is already applied; search is
  /// applied locally for instant feedback while typing.
  List<Clinic> get filteredClinics {
    var list = List<Clinic>.from(clinics);

    // Search – local for instant UX
    final q = query.trim().toLowerCase();
    if (q.isNotEmpty) {
      list = list
          .where(
            (c) =>
                c.name.toLowerCase().contains(q) ||
                c.neighborhood.toLowerCase().contains(q),
          )
          .toList();
    }

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

  /// Filtered doctor list based on query + sort.
  /// Server-side filtering (specialty) is already applied; search is applied
  /// locally for instant feedback while typing.
  List<Doctor> get filteredDoctors {
    var list = List<Doctor>.from(doctors);

    // Search – local for instant UX
    final q = query.trim().toLowerCase();
    if (q.isNotEmpty) {
      list = list
          .where(
            (d) =>
                d.name.toLowerCase().contains(q) ||
                d.specialty.toLowerCase().contains(q) ||
                d.primaryClinic.toLowerCase().contains(q),
          )
          .toList();
    }

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

  // ── Helpers ───────────────────────────────────────────────

  String? _commaJoin(List<String>? values) {
    if (values == null || values.isEmpty) return null;
    return values.join(',');
  }

  // ── Data fetching ─────────────────────────────────────────

  Future<void> loadData() async {
    state = state.copyWith(loading: true, resetVisible: true);
    _clinicPage = 1;
    _doctorPage = 1;
    _clinicHasMore = true;
    _doctorHasMore = true;

    await Future.wait([_fetchClinicsPage(page: 1), _fetchDoctorsPage(page: 1)]);

    state = state.copyWith(loading: false);
  }

  /// Fetch a page of clinics from the API with current search/filter/proximity
  /// params. When [append] is true the results are appended to the existing list.
  Future<void> _fetchClinicsPage({int? page, bool append = false}) async {
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
  Future<void> _fetchDoctorsPage({int? page, bool append = false}) async {
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
    state = state.copyWith(loading: true);
    try {
      if (state.activeTab == 'clinic') {
        _clinicPage = 1;
        await _fetchClinicsPage(page: 1);
      } else {
        _doctorPage = 1;
        await _fetchDoctorsPage(page: 1);
      }
    } catch (_) {
      // Silently handle API errors during refresh – the existing list stays
      // visible (or empty if first load).
    }
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
  }

  void setTab(String tab) {
    state = state.copyWith(activeTab: tab, resetVisible: true);
  }

  void setQuery(String query) {
    state = state.copyWith(query: query, resetVisible: true);
  }

  void setFilters(Map<String, List<String>> filters) {
    state = state.copyWith(filters: filters, resetVisible: true);
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
