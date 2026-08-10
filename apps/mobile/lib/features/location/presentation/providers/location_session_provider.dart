import 'dart:async';

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

import 'package:atlasmed_mobile_app/features/location/data/location_service.dart';

enum LocationSessionPhase { unknown, checking, ready, blocked }

class LocationSessionState {
  const LocationSessionState({
    this.phase = LocationSessionPhase.unknown,
    this.location,
    this.failure,
  });

  final LocationSessionPhase phase;
  final DeviceLocation? location;
  final LocationFailure? failure;

  /// Shell may stay open while a soft recheck runs, as long as we still have
  /// a cached fix and have not been blocked.
  bool get isUsable =>
      location != null && phase != LocationSessionPhase.blocked;

  bool get isSettled =>
      phase == LocationSessionPhase.ready ||
      phase == LocationSessionPhase.blocked;

  LocationSessionState copyWith({
    LocationSessionPhase? phase,
    DeviceLocation? location,
    LocationFailure? failure,
    bool clearLocation = false,
    bool clearFailure = false,
  }) {
    return LocationSessionState(
      phase: phase ?? this.phase,
      location: clearLocation ? null : (location ?? this.location),
      failure: clearFailure ? null : (failure ?? this.failure),
    );
  }
}

final locationPlatformProvider = Provider<LocationPlatform>((ref) {
  return GeolocatorLocationPlatform();
});

final locationServiceProvider = Provider<LocationService>((ref) {
  return LocationService(ref.watch(locationPlatformProvider));
});

final locationSessionProvider =
    NotifierProvider<LocationSessionNotifier, LocationSessionState>(
      LocationSessionNotifier.new,
    );

class LocationSessionNotifier extends Notifier<LocationSessionState> {
  static const watchInterval = Duration(seconds: 20);

  StreamSubscription<bool>? _servicesSub;
  Timer? _watchTimer;
  bool _watching = false;
  Future<void>? _resolveInFlight;

  @override
  LocationSessionState build() {
    ref.onDispose(_stopWatchingInternal);
    return const LocationSessionState();
  }

  LocationService get _service => ref.read(locationServiceProvider);

  /// Start continuous monitoring (service stream + periodic soft checks).
  /// Call while authenticated; safe to call repeatedly.
  void startWatching() {
    if (_watching) return;
    _watching = true;

    _servicesSub = _service.locationServicesEnabledStream.listen((enabled) {
      if (!enabled) {
        _block(LocationFailure.serviceDisabled);
        return;
      }
      unawaited(revalidate());
    });

    _watchTimer = Timer.periodic(watchInterval, (_) {
      unawaited(revalidate());
    });
  }

  /// Stop monitoring (e.g. on logout).
  void stopWatching() {
    _stopWatchingInternal();
    state = const LocationSessionState();
  }

  void _stopWatchingInternal() {
    _watching = false;
    _servicesSub?.cancel();
    _servicesSub = null;
    _watchTimer?.cancel();
    _watchTimer = null;
  }

  /// Soft check — does not prompt for permission; keeps shell usable until
  /// failure is confirmed.
  Future<void> revalidate() =>
      _resolve(requestPermission: false, markChecking: false);

  /// Initial / user-driven request. May show the OS permission dialog.
  Future<void> ensureLocation() {
    startWatching();
    return _resolve(requestPermission: true, markChecking: true);
  }

  Future<void> _resolve({
    required bool requestPermission,
    required bool markChecking,
  }) {
    final existing = _resolveInFlight;
    if (existing != null) return existing;

    final future = () async {
      final hadFix = state.location != null;
      if (markChecking && !hadFix) {
        state = state.copyWith(
          phase: LocationSessionPhase.checking,
          clearFailure: true,
        );
      }

      // Prefer last known fix when a fresh reading times out (common on
      // simulator / weak GPS) so Explorar is not blocked forever.
      final result = requestPermission
          ? await _service.requestCurrentLocation()
          : await _service.checkCurrentLocation();

      switch (result) {
        case LocationAvailable(:final location):
          state = LocationSessionState(
            phase: LocationSessionPhase.ready,
            location: location,
          );
        case LocationUnavailable(:final failure):
          if (hadFix && failure == LocationFailure.unavailable) {
            // Keep prior fix; treat as still ready.
            state = state.copyWith(phase: LocationSessionPhase.ready);
          } else {
            _block(failure);
          }
      }
    }();

    _resolveInFlight = future.whenComplete(() {
      _resolveInFlight = null;
    });
    return _resolveInFlight!;
  }

  void _block(LocationFailure failure) {
    state = LocationSessionState(
      phase: LocationSessionPhase.blocked,
      failure: failure,
    );
  }

  Future<void> openSystemSettings() async {
    // Browsers have no app-settings surface to open (geolocator_web throws
    // from openAppSettings/openLocationSettings). The gate screen hides the
    // settings button on web; this guard is defense in depth — stay a no-op
    // so re-prompting via ensureLocation() remains the only course of action.
    if (kIsWeb) return;
    final failure = state.failure;
    if (failure == LocationFailure.serviceDisabled) {
      await Geolocator.openLocationSettings();
      return;
    }
    await Geolocator.openAppSettings();
  }

  /// Distance in meters between [previous] and [next], or null if either missing.
  static double? distanceMeters(DeviceLocation? previous, DeviceLocation next) {
    if (previous == null) return null;
    return Geolocator.distanceBetween(
      previous.latitude,
      previous.longitude,
      next.latitude,
      next.longitude,
    );
  }
}
