import 'package:atlasmed_mobile_app/core/state/dispose_safe_state_notifier.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/payer_catalog.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_payer_shares_repository.dart';

class FacilityPayersState {
  const FacilityPayersState({
    this.payers = const [],
    this.loading = false,
    this.saving = false,
    this.error,
  });

  final List<PayerShare> payers;
  final bool loading;
  final bool saving;
  final Object? error;

  PayerMixSummary? get summary => buildPayerMixSummary(payers);

  FacilityPayersState copyWith({
    List<PayerShare>? payers,
    bool? loading,
    bool? saving,
    Object? error,
    bool clearError = false,
  }) {
    return FacilityPayersState(
      payers: payers ?? this.payers,
      loading: loading ?? this.loading,
      saving: saving ?? this.saving,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

class FacilityPayersNotifier extends StateNotifier<FacilityPayersState>
    with DisposeSafeStateWrites<FacilityPayersState> {
  FacilityPayersNotifier({required this.facilityId})
    : super(const FacilityPayersState(loading: true)) {
    _load();
  }

  final int facilityId;
  bool _inFlight = false;

  Future<void> _load() async {
    if (_inFlight) return;
    _inFlight = true;
    state = state.copyWith(loading: true, clearError: true);
    try {
      final repo = FacilityPayerSharesRepository(facilityId);
      try {
        final payers = await repo.loadShares();
        state = FacilityPayersState(payers: payers);
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

  Future<List<PayerShare>> replace(List<PayerShare> next) async {
    state = state.copyWith(saving: true, clearError: true);
    final repo = FacilityPayerSharesRepository(facilityId);
    try {
      final saved = await repo.replaceShares(next);
      state = FacilityPayersState(payers: saved);
      return saved;
    } catch (error) {
      state = state.copyWith(saving: false, error: error);
      rethrow;
    } finally {
      repo.dispose();
    }
  }
}

final facilityPayersProvider = StateNotifierProvider.autoDispose
    .family<FacilityPayersNotifier, FacilityPayersState, int>((
      ref,
      facilityId,
    ) {
      return FacilityPayersNotifier(facilityId: facilityId);
    });

/// Active catalog for the Fontes Pagadoras "Adicionar" sheet.
final healthcareProvidersCatalogProvider =
    FutureProvider.autoDispose<List<PayerCatalogEntry>>((ref) async {
      final repo = HealthcareProvidersRepository(limit: 100, isActive: true);
      try {
        final providers = await repo.loadProviders();
        return providers
            .where((p) => p.isActive)
            .map((p) => p.toCatalogEntry())
            .toList(growable: false);
      } finally {
        repo.dispose();
      }
    });
