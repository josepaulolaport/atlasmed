import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_mock.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_nearby_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_orders_repository.dart';

class FacilityOrdersState {
  const FacilityOrdersState({
    this.orders = const [],
    this.loading = false,
    this.error,
  });

  final List<FacilityOrderSummary> orders;
  final bool loading;
  final Object? error;

  FacilityOrdersState copyWith({
    List<FacilityOrderSummary>? orders,
    bool? loading,
    Object? error,
    bool clearError = false,
  }) {
    return FacilityOrdersState(
      orders: orders ?? this.orders,
      loading: loading ?? this.loading,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

class FacilityOrdersNotifier extends StateNotifier<FacilityOrdersState> {
  FacilityOrdersNotifier({required this.facilityId})
    : super(const FacilityOrdersState(loading: true)) {
    _load();
  }

  final String facilityId;
  bool _inFlight = false;

  Future<void> _load() async {
    if (_inFlight) return;
    _inFlight = true;
    state = state.copyWith(loading: true, clearError: true);
    try {
      if (isMockNearbyFacilityId(facilityId)) {
        final sections = facilityId.endsWith(':empty')
            ? mockEmptyEstablishmentDetailSections(facilityId)
            : mockEstablishmentDetailSections(facilityId);
        state = FacilityOrdersState(orders: sections.orders);
        return;
      }

      final repo = FacilityOrdersRepository(facilityId: facilityId, limit: 5);
      try {
        final orders = await repo.loadOrders();
        state = FacilityOrdersState(orders: orders);
      } finally {
        repo.dispose();
      }
    } catch (error) {
      state = state.copyWith(loading: false, error: error);
    } finally {
      _inFlight = false;
    }
  }

  Future<void> retry() => _load();
}

final facilityOrdersProvider =
    StateNotifierProvider.family<
      FacilityOrdersNotifier,
      FacilityOrdersState,
      String
    >((ref, facilityId) {
      return FacilityOrdersNotifier(facilityId: facilityId);
    });
