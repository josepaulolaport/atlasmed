import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/explore/data/clinic_detail.dart';
import 'package:atlasmed_mobile_app/features/explore/data/doctor_detail.dart';
import 'package:atlasmed_mobile_app/features/explore/data/explore_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/professional_note.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/professional_notes_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/clinic.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/doctor.dart';
import 'package:atlasmed_mobile_app/features/explore/data/mock_explore_repository.dart';
import 'package:atlasmed_mobile_app/features/location/data/location_service.dart';

// ── Repository provider ─────────────────────────────────────
final exploreRepositoryProvider = Provider<ExploreRepository>((ref) {
  return MockExploreRepository();
});

final locationServiceProvider = Provider<LocationService>((ref) {
  return LocationService(GeolocatorLocationPlatform());
});

// ── Clinic detail provider ──────────────────────────────────
final clinicDetailProvider = FutureProvider.family<ClinicDetail, String>((
  ref,
  id,
) {
  final repo = ref.watch(exploreRepositoryProvider);
  return repo.getClinicDetail(id);
});

// ── Doctor detail provider ──────────────────────────────────
final doctorDetailProvider = FutureProvider.family<DoctorDetail, String>((
  ref,
  id,
) {
  final repo = ref.watch(exploreRepositoryProvider);
  return repo.getDoctorDetail(id);
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
  final String activeTab; // 'clinic' | 'doctor'
  final String query;
  final Map<String, List<String>>
  filters; // {status: [...], products: [...], specialties: [...]}
  final String sort;
  final int visibleCount;
  // Coordinates are retained until the list API accepts proximity parameters.
  final DeviceLocation? proximityOrigin;
  final LocationFailure? proximityFailure;
  final bool requestingProximity;

  const ExploreState({
    this.clinics = const [],
    this.doctors = const [],
    this.loading = true,
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

  /// Filtered clinic list based on query + filters + sort.
  List<Clinic> get filteredClinics {
    var list = List<Clinic>.from(clinics);

    // Search
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

    // Status filter
    final statusFilter = filters['status'] ?? [];
    if (statusFilter.isNotEmpty) {
      list = list.where((c) => statusFilter.contains(c.status.name)).toList();
    }

    // Product filter
    final productFilter = filters['products'] ?? [];
    if (productFilter.isNotEmpty) {
      list = list
          .where((c) => c.products.any((p) => productFilter.contains(p)))
          .toList();
    }

    // Sort
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

  /// Filtered doctor list based on query + filters + sort.
  List<Doctor> get filteredDoctors {
    var list = List<Doctor>.from(doctors);

    // Search
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

    // Specialty filter
    final specFilter = filters['specialties'] ?? [];
    if (specFilter.isNotEmpty) {
      list = list.where((d) => specFilter.contains(d.specialty)).toList();
    }

    // Sort
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
  final ExploreRepository _repository;
  final LocationService _locationService;

  ExploreNotifier(this._repository, this._locationService)
    : super(const ExploreState());

  Future<void> loadData() async {
    state = state.copyWith(loading: true, resetVisible: true);
    final results = await Future.wait([
      _repository.getClinics(),
      _repository.getDoctors(),
    ]);
    state = state.copyWith(
      clinics: results[0] as List<Clinic>,
      doctors: results[1] as List<Doctor>,
      loading: false,
    );
  }

  Future<void> enableProximity() async {
    state = state.copyWith(
      requestingProximity: true,
      clearProximityFailure: true,
    );
    final result = await _locationService.requestCurrentLocation();

    switch (result) {
      case LocationAvailable(:final location):
        // The current API has no proximity query contract, so retain the origin
        // for the API repository to submit when that contract is introduced.
        state = state.copyWith(
          proximityOrigin: location,
          requestingProximity: false,
          clearProximityFailure: true,
          resetVisible: true,
        );
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

  void loadMore() {
    state = state.copyWith(visibleCount: state.visibleCount + 15);
  }
}

// ── Provider ────────────────────────────────────────────────
final exploreProvider = StateNotifierProvider<ExploreNotifier, ExploreState>((
  ref,
) {
  final repo = ref.watch(exploreRepositoryProvider);
  final locationService = ref.watch(locationServiceProvider);
  return ExploreNotifier(repo, locationService);
});
