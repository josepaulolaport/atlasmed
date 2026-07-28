import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_nearby_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_orders_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/clinic_detail_linha_provider.dart';

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
  FacilityOrdersNotifier({required this.facilityId, this.verticalId})
    : super(const FacilityOrdersState(loading: true)) {
    _load();
  }

  final String facilityId;
  final String? verticalId;
  bool _inFlight = false;

  Future<void> _load() async {
    if (_inFlight) return;
    _inFlight = true;
    state = state.copyWith(loading: true, clearError: true);
    try {
      if (isMockNearbyFacilityId(facilityId)) {
        state = const FacilityOrdersState(orders: []);
        return;
      }

      final repo = FacilityOrdersRepository(
        facilityId: facilityId,
        limit: 5,
        verticalId: verticalId,
      );
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

final facilityOrdersProvider = StateNotifierProvider.autoDispose
    .family<FacilityOrdersNotifier, FacilityOrdersState, String>((
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
