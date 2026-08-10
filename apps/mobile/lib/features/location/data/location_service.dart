import 'dart:async';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:geolocator/geolocator.dart';

class DeviceLocation {
  final double latitude;
  final double longitude;

  const DeviceLocation({required this.latitude, required this.longitude});

  @override
  bool operator ==(Object other) =>
      other is DeviceLocation &&
      latitude == other.latitude &&
      longitude == other.longitude;

  @override
  int get hashCode => Object.hash(latitude, longitude);
}

enum LocationPermissionStatus { denied, deniedForever, whileInUse, always }

enum LocationFailure { serviceDisabled, denied, deniedForever, unavailable }

sealed class LocationResult {
  const LocationResult();
}

class LocationAvailable extends LocationResult {
  final DeviceLocation location;

  const LocationAvailable(this.location);

  @override
  bool operator ==(Object other) =>
      other is LocationAvailable && other.location == location;

  @override
  int get hashCode => location.hashCode;
}

class LocationUnavailable extends LocationResult {
  final LocationFailure failure;

  const LocationUnavailable(this.failure);

  @override
  bool operator ==(Object other) =>
      other is LocationUnavailable && other.failure == failure;

  @override
  int get hashCode => failure.hashCode;
}

class LocationPlatformException implements Exception {
  const LocationPlatformException();
}

abstract interface class LocationPlatform {
  Future<bool> isLocationServiceEnabled();
  Future<LocationPermissionStatus> checkPermission();
  Future<LocationPermissionStatus> requestPermission();
  Future<DeviceLocation> getCurrentPosition();

  /// Emits when OS location services are toggled (true = enabled).
  Stream<bool> get locationServicesEnabledStream;
}

class LocationService {
  final LocationPlatform _platform;

  LocationService(this._platform);

  Stream<bool> get locationServicesEnabledStream =>
      _platform.locationServicesEnabledStream;

  /// Prompt for permission if needed, then read a fix.
  Future<LocationResult> requestCurrentLocation() =>
      _resolve(requestIfDenied: true);

  /// Soft check — never shows the permission dialog. Used for continuous
  /// monitoring after the user is already past the location gate.
  Future<LocationResult> checkCurrentLocation() =>
      _resolve(requestIfDenied: false);

  Future<LocationResult> _resolve({required bool requestIfDenied}) async {
    try {
      if (!await _platform.isLocationServiceEnabled()) {
        return const LocationUnavailable(LocationFailure.serviceDisabled);
      }

      var permission = await _platform.checkPermission();
      if (permission == LocationPermissionStatus.denied && requestIfDenied) {
        permission = await _platform.requestPermission();
      }

      if (permission == LocationPermissionStatus.deniedForever) {
        return const LocationUnavailable(LocationFailure.deniedForever);
      }
      if (permission == LocationPermissionStatus.denied) {
        return const LocationUnavailable(LocationFailure.denied);
      }

      return LocationAvailable(await _platform.getCurrentPosition());
    } on LocationPlatformException {
      return const LocationUnavailable(LocationFailure.unavailable);
    }
  }
}

class GeolocatorLocationPlatform implements LocationPlatform {
  DeviceLocation? get _fixedLocation {
    final fixed = AppConfig.debugFixedLocation;
    if (fixed == null) return null;
    return DeviceLocation(latitude: fixed.latitude, longitude: fixed.longitude);
  }

  @override
  Future<LocationPermissionStatus> checkPermission() async {
    if (_fixedLocation != null) return LocationPermissionStatus.whileInUse;
    return _permissionFrom(await Geolocator.checkPermission());
  }

  @override
  Future<DeviceLocation> getCurrentPosition() async {
    final fixed = _fixedLocation;
    if (fixed != null) return fixed;

    try {
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
          // Simulator / weak GPS can hang forever without a deadline.
          timeLimit: Duration(seconds: 8),
        ),
      );
      return DeviceLocation(
        latitude: position.latitude,
        longitude: position.longitude,
      );
    } catch (_) {
      try {
        final last = await Geolocator.getLastKnownPosition();
        if (last != null) {
          return DeviceLocation(
            latitude: last.latitude,
            longitude: last.longitude,
          );
        }
      } catch (_) {}
      throw const LocationPlatformException();
    }
  }

  @override
  Future<bool> isLocationServiceEnabled() async {
    if (_fixedLocation != null) return true;
    return Geolocator.isLocationServiceEnabled();
  }

  /// Browsers apply no timeout to an unanswered geolocation prompt (Chrome
  /// waits indefinitely), so without a bound the location gate would sit in
  /// "checking" forever on web. With this deadline the flow degrades to the
  /// blocked state, whose retry button re-prompts with a user gesture; the
  /// periodic revalidate then self-heals once permission is granted.
  static const _webPermissionDeadline = Duration(seconds: 20);

  @override
  Future<LocationPermissionStatus> requestPermission() async {
    if (_fixedLocation != null) return LocationPermissionStatus.whileInUse;
    final request = Geolocator.requestPermission();
    if (!kIsWeb) return _permissionFrom(await request);
    try {
      return _permissionFrom(await request.timeout(_webPermissionDeadline));
    } on TimeoutException {
      throw const LocationPlatformException();
    }
  }

  @override
  Stream<bool> get locationServicesEnabledStream {
    if (_fixedLocation != null || kIsWeb) return Stream<bool>.value(true);
    // geolocator_web's getServiceStatusStream() throws UnsupportedError and
    // its isLocationServiceEnabled() always reports true — the web platform
    // has no OS-level location service toggle to monitor.
    return Geolocator.getServiceStatusStream().map(
      (status) => status == ServiceStatus.enabled,
    );
  }

  LocationPermissionStatus _permissionFrom(LocationPermission permission) {
    return switch (permission) {
      LocationPermission.denied => LocationPermissionStatus.denied,
      LocationPermission.deniedForever =>
        LocationPermissionStatus.deniedForever,
      LocationPermission.whileInUse => LocationPermissionStatus.whileInUse,
      LocationPermission.always => LocationPermissionStatus.always,
      LocationPermission.unableToDetermine => LocationPermissionStatus.denied,
    };
  }
}
