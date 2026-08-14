import 'package:atlasmed_mobile_app/core/state/dispose_safe_state_notifier.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_orders_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/clinic_detail_linha_provider.dart';

class FacilityOrdersState {
  const FacilityOrdersState({
    this.orders = const [],
    this.loading = false,
    this.error,
    this.total = 0,
    this.page = 0,
    this.hasMore = false,
    this.loadingMore = false,
  });

  final List<FacilityOrderSummary> orders;
  final bool loading;
  final Object? error;

  /// Every order the clinic has. [orders] holds the pages fetched so far —
  /// the section used to fetch five and stop, with no way to reach the sixth
  /// on a clinic that has eighty.
  final int total;
  final int page;
  final bool hasMore;
  final bool loadingMore;

  FacilityOrdersState copyWith({
    List<FacilityOrderSummary>? orders,
    bool? loading,
    Object? error,
    bool clearError = false,
    int? total,
    int? page,
    bool? hasMore,
    bool? loadingMore,
  }) {
    return FacilityOrdersState(
      orders: orders ?? this.orders,
      loading: loading ?? this.loading,
      error: clearError ? null : (error ?? this.error),
      total: total ?? this.total,
      page: page ?? this.page,
      hasMore: hasMore ?? this.hasMore,
      loadingMore: loadingMore ?? this.loadingMore,
    );
  }
}

class FacilityOrdersNotifier extends StateNotifier<FacilityOrdersState>
    with DisposeSafeStateWrites<FacilityOrdersState> {
  FacilityOrdersNotifier({required this.facilityId, this.verticalId})
    : super(const FacilityOrdersState(loading: true)) {
    _load();
  }

  final int facilityId;
  final int? verticalId;
  bool _inFlight = false;

  /// Five per fetch, which is what the carousel shows before the rep swipes.
  /// More pages arrive as they do.
  static const int pageSize = 5;

  Future<FacilityOrdersPage> _fetch(int page) async {
    final repo = FacilityOrdersRepository(
      facilityId: facilityId,
      page: page,
      limit: pageSize,
      verticalId: verticalId,
    );
    try {
      return await repo.loadPage();
    } finally {
      repo.dispose();
    }
  }

  Future<void> _load() async {
    if (_inFlight) return;
    _inFlight = true;
    state = state.copyWith(loading: true, clearError: true);
    try {
      final page = await _fetch(1);
      state = FacilityOrdersState(
        orders: page.orders,
        total: page.total,
        page: page.page,
        hasMore: page.hasNextPage,
      );
    } catch (error) {
      state = state.copyWith(loading: false, error: error);
    } finally {
      _inFlight = false;
    }
  }

  /// Appends the next page.
  ///
  /// Swiping fires this repeatedly near the end of the carousel, so it is
  /// guarded on `loadingMore` — without that the same page is fetched and
  /// appended several times and the rep sees duplicate cards.
  Future<void> loadMore() async {
    if (_inFlight || state.loadingMore || !state.hasMore) return;
    _inFlight = true;
    state = state.copyWith(loadingMore: true);
    try {
      final next = await _fetch(state.page + 1);
      state = state.copyWith(
        orders: [...state.orders, ...next.orders],
        total: next.total,
        page: next.page,
        hasMore: next.hasNextPage,
        loadingMore: false,
      );
    } catch (_) {
      // Keep the cards already on screen; the next swipe retries.
      state = state.copyWith(loadingMore: false);
    } finally {
      _inFlight = false;
    }
  }

  Future<void> retry() => _load();
}

final facilityOrdersProvider = StateNotifierProvider.autoDispose
    .family<FacilityOrdersNotifier, FacilityOrdersState, int>((
      ref,
      facilityId,
    ) {
      final verticalId = ref.watch(
        clinicDetailActiveLinhaIdProvider(facilityId),
      );
      return FacilityOrdersNotifier(
        facilityId: facilityId,
        verticalId: verticalId,
      );
    });
