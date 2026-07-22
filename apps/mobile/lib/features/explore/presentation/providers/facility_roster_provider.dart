import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_mock.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_professionals_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_representatives_repository.dart';

/// Accumulated state for a paginated facility roster strip.
class FacilityRosterState<T> {
  const FacilityRosterState({
    this.items = const [],
    this.page = 0,
    this.total = 0,
    this.totalPages = 0,
    this.loading = false,
    this.loadingMore = false,
    this.error,
  });

  final List<T> items;
  final int page;
  final int total;
  final int totalPages;
  final bool loading;
  final bool loadingMore;
  final Object? error;

  /// Same rule as Explorar: stop the trailing loader when the last page is in.
  bool get hasMore => totalPages > 0 && page < totalPages;

  FacilityRosterState<T> copyWith({
    List<T>? items,
    int? page,
    int? total,
    int? totalPages,
    bool? loading,
    bool? loadingMore,
    Object? error,
    bool clearError = false,
  }) {
    return FacilityRosterState<T>(
      items: items ?? this.items,
      page: page ?? this.page,
      total: total ?? this.total,
      totalPages: totalPages ?? this.totalPages,
      loading: loading ?? this.loading,
      loadingMore: loadingMore ?? this.loadingMore,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

typedef FacilityRosterPageLoader<T> =
    Future<FacilityRosterPage<T>> Function({
      required String facilityId,
      required int page,
    });

class FacilityRosterNotifier<T> extends StateNotifier<FacilityRosterState<T>> {
  FacilityRosterNotifier({
    required this.facilityId,
    required FacilityRosterPageLoader<T> loadPage,
  }) : _loadPage = loadPage,
       super(const FacilityRosterState(loading: true)) {
    _loadInitial();
  }

  final String facilityId;
  final FacilityRosterPageLoader<T> _loadPage;
  bool _fetchInFlight = false;

  Future<void> _loadInitial() async {
    await _fetch(page: 1, append: false);
  }

  Future<void> loadMore() async {
    if (!state.hasMore ||
        state.loadingMore ||
        state.loading ||
        _fetchInFlight) {
      return;
    }
    await _fetch(page: state.page + 1, append: true);
  }

  Future<void> retry() async {
    if (_fetchInFlight) return;
    await _fetch(page: 1, append: false);
  }

  Future<void> _fetch({required int page, required bool append}) async {
    _fetchInFlight = true;
    state = state.copyWith(
      loading: !append,
      loadingMore: append,
      clearError: true,
    );
    try {
      final result = await _loadPage(facilityId: facilityId, page: page);
      final nextItems = append
          ? [...state.items, ...result.items]
          : result.items;
      state = FacilityRosterState<T>(
        items: nextItems,
        page: result.pagination.page,
        total: result.pagination.total,
        totalPages: result.pagination.totalPages,
      );
    } catch (error) {
      state = state.copyWith(loading: false, loadingMore: false, error: error);
    } finally {
      _fetchInFlight = false;
    }
  }
}

final facilityDoctorsRosterProvider = StateNotifierProvider.autoDispose
    .family<
      FacilityRosterNotifier<FacilityCrmDoctor>,
      FacilityRosterState<FacilityCrmDoctor>,
      String
    >((ref, facilityId) {
      return FacilityRosterNotifier<FacilityCrmDoctor>(
        facilityId: facilityId,
        loadPage: ({required facilityId, required page}) async {
          // Nearby-map mock ids (`near-*`) stay offline; real facilities hit API.
          if (facilityId.startsWith('near-') || facilityId.endsWith(':empty')) {
            return mockFacilityDoctorsPage(facilityId: facilityId, page: page);
          }
          final repo = FacilityProfessionalsRepository(
            facilityId,
            page: page,
            limit: facilityRosterPageSize,
            view: 'all',
          );
          try {
            return await repo.loadPage();
          } finally {
            repo.dispose();
          }
        },
      );
    });

final facilityAdministratorsRosterProvider = StateNotifierProvider.autoDispose
    .family<
      FacilityRosterNotifier<AdministrativeProfessional>,
      FacilityRosterState<AdministrativeProfessional>,
      String
    >((ref, facilityId) {
      return FacilityRosterNotifier<AdministrativeProfessional>(
        facilityId: facilityId,
        loadPage: ({required facilityId, required page}) async {
          // Nearby-map mock ids (`near-*`) stay offline; real facilities hit API.
          if (facilityId.startsWith('near-') || facilityId.endsWith(':empty')) {
            return mockFacilityAdministratorsPage(
              facilityId: facilityId,
              page: page,
            );
          }
          final repo = FacilityRepresentativesRepository(
            facilityId,
            page: page,
            limit: facilityRosterPageSize,
          );
          try {
            return await repo.loadPage();
          } finally {
            repo.dispose();
          }
        },
      );
    });
