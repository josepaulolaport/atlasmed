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
}

class LocationService {
  final LocationPlatform _platform;

  LocationService(this._platform);

  Future<LocationResult> requestCurrentLocation() async {
    try {
      if (!await _platform.isLocationServiceEnabled()) {
        return const LocationUnavailable(LocationFailure.serviceDisabled);
      }

      var permission = await _platform.checkPermission();
      if (permission == LocationPermissionStatus.denied) {
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
  @override
  Future<LocationPermissionStatus> checkPermission() async {
    return _permissionFrom(await Geolocator.checkPermission());
  }

  @override
  Future<DeviceLocation> getCurrentPosition() async {
    try {
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
        ),
      );
      return DeviceLocation(
        latitude: position.latitude,
        longitude: position.longitude,
      );
    } catch (_) {
      throw const LocationPlatformException();
    }
  }

  @override
  Future<bool> isLocationServiceEnabled() =>
      Geolocator.isLocationServiceEnabled();

  @override
  Future<LocationPermissionStatus> requestPermission() async {
    return _permissionFrom(await Geolocator.requestPermission());
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
