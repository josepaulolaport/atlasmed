import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/clinic_detail.dart';
import '../../data/explore_repository.dart';
import '../../data/models.dart';
import '../../data/mock_explore_repository.dart';

// ── Repository provider ─────────────────────────────────────
final exploreRepositoryProvider = Provider<ExploreRepository>((ref) {
  return MockExploreRepository();
});

// ── Clinic detail provider ──────────────────────────────────
final clinicDetailProvider =
    FutureProvider.family<ClinicDetail, String>((ref, id) {
  final repo = ref.watch(exploreRepositoryProvider);
  return repo.getClinicDetail(id);
});

// ── Explore state ───────────────────────────────────────────
class ExploreState {
  final List<Clinic> clinics;
  final List<Doctor> doctors;
  final bool loading;
  final String activeTab; // 'clinic' | 'doctor'
  final String query;
  final Map<String, List<String>> filters; // {status: [...], products: [...], specialties: [...]}
  final String sort;
  final int visibleCount;

  const ExploreState({
    this.clinics = const [],
    this.doctors = const [],
    this.loading = true,
    this.activeTab = 'clinic',
    this.query = '',
    this.filters = const {},
    this.sort = 'distance',
    this.visibleCount = 15,
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
    );
  }

  // ── Computed properties ───────────────────────────────────

  /// Filtered clinic list based on query + filters + sort.
  List<Clinic> get filteredClinics {
    var list = List<Clinic>.from(clinics);

    // Search
    final q = query.trim().toLowerCase();
    if (q.isNotEmpty) {
      list = list.where((c) =>
        c.name.toLowerCase().contains(q) ||
        c.neighborhood.toLowerCase().contains(q)
      ).toList();
    }

    // Status filter
    final statusFilter = filters['status'] ?? [];
    if (statusFilter.isNotEmpty) {
      list = list.where((c) =>
        statusFilter.contains(c.status.name)
      ).toList();
    }

    // Product filter
    final productFilter = filters['products'] ?? [];
    if (productFilter.isNotEmpty) {
      list = list.where((c) =>
        c.products.any((p) => productFilter.contains(p))
      ).toList();
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
      list = list.where((d) =>
        d.name.toLowerCase().contains(q) ||
        d.specialty.toLowerCase().contains(q) ||
        d.primaryClinic.toLowerCase().contains(q)
      ).toList();
    }

    // Specialty filter
    final specFilter = filters['specialties'] ?? [];
    if (specFilter.isNotEmpty) {
      list = list.where((d) =>
        specFilter.contains(d.specialty)
      ).toList();
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

  ExploreNotifier(this._repository) : super(const ExploreState());

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
final exploreProvider = StateNotifierProvider<ExploreNotifier, ExploreState>((ref) {
  final repo = ref.watch(exploreRepositoryProvider);
  return ExploreNotifier(repo);
});
