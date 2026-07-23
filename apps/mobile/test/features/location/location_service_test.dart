import 'package:atlasmed_mobile_app/features/location/data/location_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('returns serviceDisabled without requesting permission', () async {
    final platform = _FakeLocationPlatform(serviceEnabled: false);
    final service = LocationService(platform);

    final result = await service.requestCurrentLocation();

    expect(result, const LocationUnavailable(LocationFailure.serviceDisabled));
    expect(platform.requestPermissionCalls, 0);
    expect(platform.currentPositionCalls, 0);
  });

  test(
    'requests permission after a denied check and returns one position',
    () async {
      final platform = _FakeLocationPlatform(
        initialPermission: LocationPermissionStatus.denied,
        requestedPermission: LocationPermissionStatus.whileInUse,
        position: const DeviceLocation(
          latitude: -23.55052,
          longitude: -46.633308,
        ),
      );
      final service = LocationService(platform);

      final result = await service.requestCurrentLocation();

      expect(
        result,
        const LocationAvailable(
          DeviceLocation(latitude: -23.55052, longitude: -46.633308),
        ),
      );
      expect(platform.requestPermissionCalls, 1);
      expect(platform.currentPositionCalls, 1);
    },
  );

  test('returns deniedForever without reading the current position', () async {
    final platform = _FakeLocationPlatform(
      initialPermission: LocationPermissionStatus.deniedForever,
    );
    final service = LocationService(platform);

    final result = await service.requestCurrentLocation();

    expect(result, const LocationUnavailable(LocationFailure.deniedForever));
    expect(platform.currentPositionCalls, 0);
  });

  test(
    'checkCurrentLocation does not request permission when denied',
    () async {
      final platform = _FakeLocationPlatform(
        initialPermission: LocationPermissionStatus.denied,
      );
      final service = LocationService(platform);

      final result = await service.checkCurrentLocation();

      expect(result, const LocationUnavailable(LocationFailure.denied));
      expect(platform.requestPermissionCalls, 0);
    },
  );
}

class _FakeLocationPlatform implements LocationPlatform {
  final bool serviceEnabled;
  final LocationPermissionStatus initialPermission;
  final LocationPermissionStatus requestedPermission;
  final DeviceLocation? position;
  int requestPermissionCalls = 0;
  int currentPositionCalls = 0;

  _FakeLocationPlatform({
    this.serviceEnabled = true,
    this.initialPermission = LocationPermissionStatus.whileInUse,
    this.requestedPermission = LocationPermissionStatus.whileInUse,
    this.position,
  });

  @override
  Future<DeviceLocation> getCurrentPosition() async {
    currentPositionCalls++;
    final currentPosition = position;
    if (currentPosition == null) throw const LocationPlatformException();
    return currentPosition;
  }

  @override
  Future<bool> isLocationServiceEnabled() async => serviceEnabled;

  @override
  Future<LocationPermissionStatus> checkPermission() async => initialPermission;

  @override
  Future<LocationPermissionStatus> requestPermission() async {
    requestPermissionCalls++;
    return requestedPermission;
  }

  @override
  Stream<bool> get locationServicesEnabledStream => const Stream.empty();
}
