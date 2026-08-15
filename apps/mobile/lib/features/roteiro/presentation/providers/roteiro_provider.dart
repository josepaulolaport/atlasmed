import 'package:atlasmed_mobile_app/core/state/dispose_safe_state_notifier.dart';
import 'package:atlasmed_mobile_app/features/location/data/location_service.dart';
import 'package:atlasmed_mobile_app/features/location/presentation/providers/location_session_provider.dart';
import 'package:atlasmed_mobile_app/features/roteiro/data/repositories/roteiro_repository.dart';
import 'package:atlasmed_mobile_app/features/roteiro/data/roteiro.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final roteiroRepositoryProvider = Provider<RoteiroRepository>((ref) {
  return RoteiroRepository();
});

/// Why a generation could not start. Distinct from a failed request: the rep
/// can fix these, and the screen tells them how.
enum RoteiroBlocker {
  locationDenied,
  locationDeniedForever,
  locationOff,
  noVertical,
}

class RoteiroState {
  const RoteiroState({
    this.roteiro,
    this.loading = false,
    this.confirming = false,
    this.error,
    this.blocker,
  });

  final Roteiro? roteiro;
  final bool loading;
  final bool confirming;
  final Object? error;
  final RoteiroBlocker? blocker;

  bool get isEmpty => roteiro != null && roteiro!.stops.isEmpty;

  RoteiroState copyWith({
    Roteiro? roteiro,
    bool? loading,
    bool? confirming,
    Object? error,
    RoteiroBlocker? blocker,
    bool clearError = false,
    bool clearBlocker = false,
  }) => RoteiroState(
    roteiro: roteiro ?? this.roteiro,
    loading: loading ?? this.loading,
    confirming: confirming ?? this.confirming,
    error: clearError ? null : (error ?? this.error),
    blocker: clearBlocker ? null : (blocker ?? this.blocker),
  );
}

class RoteiroNotifier extends StateNotifier<RoteiroState>
    with DisposeSafeStateWrites<RoteiroState> {
  RoteiroNotifier(this._repository, this._location)
    : super(const RoteiroState());

  final RoteiroRepository _repository;
  final LocationService _location;

  /// Generates from the device's current position.
  ///
  /// There is no fallback origin by design (spec 0016 §4.1). If location is
  /// unavailable the screen asks for it instead of quietly planning a day from
  /// somewhere the rep is not — a plan built on a guessed position produces
  /// drive times that look exactly as trustworthy as real ones.
  Future<void> generate({
    required int verticalId,
    int? limit,
    int? anchorProfileId,
  }) async {
    state = state.copyWith(loading: true, clearError: true, clearBlocker: true);

    final result = await _location.requestCurrentLocation();
    if (result is! LocationAvailable) {
      state = state.copyWith(
        loading: false,
        blocker: switch ((result as LocationUnavailable).failure) {
          LocationFailure.serviceDisabled => RoteiroBlocker.locationOff,
          LocationFailure.deniedForever => RoteiroBlocker.locationDeniedForever,
          _ => RoteiroBlocker.locationDenied,
        },
      );
      return;
    }

    try {
      final roteiro = await _repository.generate(
        verticalId: verticalId,
        latitude: result.location.latitude,
        longitude: result.location.longitude,
        limit: limit,
        anchorProfileId: anchorProfileId,
      );
      state = RoteiroState(roteiro: roteiro, loading: false);
    } catch (error) {
      state = state.copyWith(loading: false, error: error);
    }
  }

  /// Writes the plan into the agent's agenda.
  ///
  /// Returns true when it landed. A 409 means the agenda moved under the plan;
  /// the times are never silently adjusted, so the rep is told to regenerate.
  Future<bool> confirm() async {
    final id = state.roteiro?.id;
    if (id == null) return false;
    state = state.copyWith(confirming: true, clearError: true);
    try {
      final confirmed = await _repository.confirm(id);
      state = state.copyWith(roteiro: confirmed, confirming: false);
      return true;
    } catch (error) {
      state = state.copyWith(confirming: false, error: error);
      return false;
    }
  }
}

final roteiroProvider = StateNotifierProvider<RoteiroNotifier, RoteiroState>((
  ref,
) {
  return RoteiroNotifier(
    ref.watch(roteiroRepositoryProvider),
    ref.watch(locationServiceProvider),
  );
});
