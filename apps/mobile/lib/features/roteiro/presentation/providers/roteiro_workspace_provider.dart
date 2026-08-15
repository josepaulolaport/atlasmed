import 'package:atlasmed_mobile_app/core/state/dispose_safe_state_notifier.dart';
import 'package:atlasmed_mobile_app/features/location/data/location_service.dart';
import 'package:atlasmed_mobile_app/features/location/presentation/providers/location_session_provider.dart';
import 'package:atlasmed_mobile_app/features/roteiro/data/repositories/roteiro_repository.dart';
import 'package:atlasmed_mobile_app/features/roteiro/data/roteiro.dart';
import 'package:atlasmed_mobile_app/features/roteiro/presentation/providers/roteiro_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Which day the workspace is planning.
class RoteiroWorkspaceKey {
  const RoteiroWorkspaceKey({
    required this.verticalId,
    required this.scopeDate,
  });

  final int verticalId;

  /// `YYYY-MM-DD`.
  final String scopeDate;

  @override
  bool operator ==(Object other) =>
      other is RoteiroWorkspaceKey &&
      other.verticalId == verticalId &&
      other.scopeDate == scopeDate;

  @override
  int get hashCode => Object.hash(verticalId, scopeDate);
}

class RoteiroWorkspaceState {
  const RoteiroWorkspaceState({
    this.roteiro,
    this.loading = false,
    this.saving = false,
    this.saved = false,
    this.error,
    this.blocker,
    this.excluded = const {},
    this.included = const {},
  });

  final Roteiro? roteiro;
  final bool loading;
  final bool saving;

  /// Once saved the day exists in the calendar and the workspace stops being
  /// the place to change it — further edits belong in the agenda.
  final bool saved;
  final Object? error;
  final RoteiroBlocker? blocker;

  /// The rep's edits, held here rather than on the server: nothing is real
  /// until they save, so a draft they walk away from costs nothing.
  final Set<int> excluded;
  final Set<int> included;

  bool get dirty => excluded.isNotEmpty || included.isNotEmpty;

  RoteiroWorkspaceState copyWith({
    Roteiro? roteiro,
    bool? loading,
    bool? saving,
    bool? saved,
    Object? error,
    RoteiroBlocker? blocker,
    Set<int>? excluded,
    Set<int>? included,
    bool clearError = false,
    bool clearBlocker = false,
  }) => RoteiroWorkspaceState(
    roteiro: roteiro ?? this.roteiro,
    loading: loading ?? this.loading,
    saving: saving ?? this.saving,
    saved: saved ?? this.saved,
    error: clearError ? null : (error ?? this.error),
    blocker: clearBlocker ? null : (blocker ?? this.blocker),
    excluded: excluded ?? this.excluded,
    included: included ?? this.included,
  );
}

/// The loop a rep actually works in: generate, look, drop one, regenerate,
/// look again — and only then commit.
///
/// Every edit re-asks the server rather than mutating the slate locally. It
/// costs a round trip and buys correctness: removing a stop frees time and
/// changes what fits in the gap it left, which only the engine can work out.
/// A client that spliced the list would show a day whose times its own route
/// contradicts.
class RoteiroWorkspaceNotifier extends StateNotifier<RoteiroWorkspaceState>
    with DisposeSafeStateWrites<RoteiroWorkspaceState> {
  RoteiroWorkspaceNotifier(this._repository, this._location, this._key)
    : super(const RoteiroWorkspaceState());

  final RoteiroRepository _repository;
  final LocationService _location;
  final RoteiroWorkspaceKey _key;

  bool get _isToday {
    final now = DateTime.now();
    final today =
        '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
    return _key.scopeDate == today;
  }

  Future<void> generate() async {
    state = state.copyWith(loading: true, clearError: true, clearBlocker: true);

    double? lat;
    double? lng;
    // Only today can start from where the rep is standing. For any other day
    // the server resolves the origin from the schedule, and says so when it
    // cannot (§15.4.1).
    if (_isToday) {
      final result = await _location.requestCurrentLocation();
      if (result is! LocationAvailable) {
        state = state.copyWith(
          loading: false,
          blocker: switch ((result as LocationUnavailable).failure) {
            LocationFailure.serviceDisabled => RoteiroBlocker.locationOff,
            LocationFailure.deniedForever =>
              RoteiroBlocker.locationDeniedForever,
            _ => RoteiroBlocker.locationDenied,
          },
        );
        return;
      }
      lat = result.location.latitude;
      lng = result.location.longitude;
    }

    try {
      final roteiro = await _repository.generate(
        verticalId: _key.verticalId,
        scopeDate: _key.scopeDate,
        latitude: lat,
        longitude: lng,
        excludeProfileIds: state.excluded.toList(),
        includeProfileIds: state.included.toList(),
      );
      state = state.copyWith(roteiro: roteiro, loading: false);
    } catch (error) {
      state = state.copyWith(loading: false, error: error);
    }
  }

  /// Drops a stop and re-plans. The freed time is refilled by the engine, not
  /// left as a hole.
  Future<void> remove(int facilityVerticalProfileId) async {
    state = state.copyWith(
      excluded: {...state.excluded, facilityVerticalProfileId},
      included: {...state.included}..remove(facilityVerticalProfileId),
    );
    await generate();
  }

  /// Adds a clinic the rep named. It goes in ahead of the ranking.
  Future<void> add(int facilityVerticalProfileId) async {
    state = state.copyWith(
      included: {...state.included, facilityVerticalProfileId},
      excluded: {...state.excluded}..remove(facilityVerticalProfileId),
    );
    await generate();
  }

  /// Throws the rep's edits away and asks for a clean plan.
  Future<void> reset() async {
    state = state.copyWith(excluded: const {}, included: const {});
    await generate();
  }

  /// Commits the day: persists the slate and writes it into the calendar.
  Future<bool> save() async {
    if (state.roteiro == null || state.roteiro!.stops.isEmpty) return false;
    state = state.copyWith(saving: true, clearError: true);
    double? lat;
    double? lng;
    if (_isToday) {
      final result = await _location.requestCurrentLocation();
      if (result is LocationAvailable) {
        lat = result.location.latitude;
        lng = result.location.longitude;
      }
    }
    try {
      final saved = await _repository.save(
        verticalId: _key.verticalId,
        scopeDate: _key.scopeDate,
        latitude: lat,
        longitude: lng,
        excludeProfileIds: state.excluded.toList(),
        includeProfileIds: state.included.toList(),
      );
      state = state.copyWith(roteiro: saved, saving: false, saved: true);
      return true;
    } catch (error) {
      state = state.copyWith(saving: false, error: error);
      return false;
    }
  }
}

final roteiroWorkspaceProvider = StateNotifierProvider.autoDispose
    .family<
      RoteiroWorkspaceNotifier,
      RoteiroWorkspaceState,
      RoteiroWorkspaceKey
    >((ref, key) {
      return RoteiroWorkspaceNotifier(
        ref.watch(roteiroRepositoryProvider),
        ref.watch(locationServiceProvider),
        key,
      );
    });
