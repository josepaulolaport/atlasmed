import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/config/api_config.dart';
import '../../../../core/network/api_client.dart';
import '../../data/clinic_detail.dart';
import '../../data/doctor_detail.dart';
import '../../data/explore_list_filters.dart';
import '../../data/explore_repository.dart';
import '../../data/mock_explore_repository.dart';
import '../../data/api_explore_repository.dart';
import '../../data/models.dart';

final exploreRepositoryProvider = Provider<ExploreRepository>((ref) {
  if (ApiConfig.useMockExplore) {
    return MockExploreRepository();
  }
  return ApiExploreRepository(ref.watch(apiClientProvider));
});

final exploreFilterOptionsProvider = FutureProvider<ExploreFilterOptions>((ref) {
  return ref.watch(exploreRepositoryProvider).getFacilityFilterOptions();
});

final clinicDetailProvider =
    FutureProvider.family<ClinicDetail, String>((ref, id) {
  final repo = ref.watch(exploreRepositoryProvider);
  return repo.getClinicDetail(id);
});

final doctorDetailProvider =
    FutureProvider.family<DoctorDetail, String>((ref, id) {
  final repo = ref.watch(exploreRepositoryProvider);
  return repo.getDoctorDetail(id);
});

class ExploreState {
  final List<Clinic> clinics;
  final List<Doctor> doctors;
  final bool loading;
  final bool loadingMore;
  final bool clinicHasMore;
  final bool doctorHasMore;
  final int clinicPage;
  final int doctorPage;
  final String activeTab;
  final String query;
  final Map<String, List<String>> filters;
  final String sort;

  const ExploreState({
    this.clinics = const [],
    this.doctors = const [],
    this.loading = true,
    this.loadingMore = false,
    this.clinicHasMore = false,
    this.doctorHasMore = false,
    this.clinicPage = 0,
    this.doctorPage = 0,
    this.activeTab = 'clinic',
    this.query = '',
    this.filters = const {},
    this.sort = 'distance',
  });

  ExploreState copyWith({
    List<Clinic>? clinics,
    List<Doctor>? doctors,
    bool? loading,
    bool? loadingMore,
    bool? clinicHasMore,
    bool? doctorHasMore,
    int? clinicPage,
    int? doctorPage,
    String? activeTab,
    String? query,
    Map<String, List<String>>? filters,
    String? sort,
  }) {
    return ExploreState(
      clinics: clinics ?? this.clinics,
      doctors: doctors ?? this.doctors,
      loading: loading ?? this.loading,
      loadingMore: loadingMore ?? this.loadingMore,
      clinicHasMore: clinicHasMore ?? this.clinicHasMore,
      doctorHasMore: doctorHasMore ?? this.doctorHasMore,
      clinicPage: clinicPage ?? this.clinicPage,
      doctorPage: doctorPage ?? this.doctorPage,
      activeTab: activeTab ?? this.activeTab,
      query: query ?? this.query,
      filters: filters ?? this.filters,
      sort: sort ?? this.sort,
    );
  }

  ExploreListFilters get clinicListFilters => ExploreListFilters(
        stateCodes: filters['state'] ?? const [],
        cities: filters['city'] ?? const [],
        facilityTypes: filters['facilityType'] ?? const [],
      );

  List<Clinic> get filteredClinics {
    var list = List<Clinic>.from(clinics);

    final statusFilter = filters['status'] ?? [];
    if (statusFilter.isNotEmpty) {
      list = list.where((c) => statusFilter.contains(c.status.name)).toList();
    }

    final productFilter = filters['products'] ?? [];
    if (productFilter.isNotEmpty) {
      list = list.where((c) => c.products.any((p) => productFilter.contains(p))).toList();
    }

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

  List<Doctor> get filteredDoctors {
    var list = List<Doctor>.from(doctors);

    final specFilter = filters['specialties'] ?? [];
    if (specFilter.isNotEmpty) {
      list = list.where((d) => specFilter.contains(d.specialty)).toList();
    }

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

class ExploreNotifier extends StateNotifier<ExploreState> {
  ExploreNotifier(this._repository) : super(const ExploreState());

  final ExploreRepository _repository;
  Timer? _searchDebounce;

  @override
  void dispose() {
    _searchDebounce?.cancel();
    super.dispose();
  }

  String? get _searchParam {
    final search = state.query.trim();
    return search.length >= 2 ? search : null;
  }

  Future<void> loadData({bool showFullScreenLoading = true}) async {
    state = state.copyWith(
      loading: showFullScreenLoading,
      loadingMore: !showFullScreenLoading,
    );

    if (state.activeTab == 'clinic') {
      final page = await _repository.getClinics(
        search: _searchParam,
        filters: state.clinicListFilters,
        page: 1,
      );
      state = state.copyWith(
        clinics: page.items,
        clinicPage: 1,
        clinicHasMore: page.hasMore,
        loading: false,
        loadingMore: false,
      );
      return;
    }

    final page = await _repository.getDoctors(search: _searchParam, page: 1);
    state = state.copyWith(
      doctors: page.items,
      doctorPage: 1,
      doctorHasMore: page.hasMore,
      loading: false,
      loadingMore: false,
    );
  }

  Future<void> setTab(String tab) async {
    state = state.copyWith(activeTab: tab);
    if (tab == 'doctor' && state.doctors.isEmpty) {
      await loadData();
    } else if (tab == 'clinic' && state.clinics.isEmpty) {
      await loadData();
    }
  }

  void setQuery(String query) {
    state = state.copyWith(query: query);
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 400), () {
      loadData();
    });
  }

  Future<void> setFilters(Map<String, List<String>> filters) async {
    state = state.copyWith(filters: filters);
    if (state.activeTab == 'clinic') {
      await loadData(showFullScreenLoading: false);
    }
  }

  void setSort(String sort) {
    state = state.copyWith(sort: sort);
  }

  Future<void> loadMore() async {
    if (state.loading || state.loadingMore) return;

    if (state.activeTab == 'clinic') {
      if (!state.clinicHasMore) return;
      state = state.copyWith(loadingMore: true);
      final nextPage = state.clinicPage + 1;
      final page = await _repository.getClinics(
        search: _searchParam,
        filters: state.clinicListFilters,
        page: nextPage,
      );
      state = state.copyWith(
        clinics: [...state.clinics, ...page.items],
        clinicPage: nextPage,
        clinicHasMore: page.hasMore,
        loadingMore: false,
      );
      return;
    }

    if (!state.doctorHasMore) return;
    state = state.copyWith(loadingMore: true);
    final nextPage = state.doctorPage + 1;
    final page = await _repository.getDoctors(search: _searchParam, page: nextPage);
    state = state.copyWith(
      doctors: [...state.doctors, ...page.items],
      doctorPage: nextPage,
      doctorHasMore: page.hasMore,
      loadingMore: false,
    );
  }
}

final exploreProvider = StateNotifierProvider<ExploreNotifier, ExploreState>((ref) {
  final repo = ref.watch(exploreRepositoryProvider);
  return ExploreNotifier(repo);
});
