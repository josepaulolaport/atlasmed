import 'package:atlasmed_mobile_app/repository/base_repository.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_cache_storage.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/explore_provider.dart';
import 'package:atlasmed_mobile_app/features/location/data/location_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  setUp(() {
    BaseRepository.storage = const _MemoryCacheStorage();
  });

  test('retains the user location after enabling proximity', () async {
    final notifier = ExploreNotifier(
      _LocationServiceReturning(
        const LocationAvailable(
          DeviceLocation(latitude: -23.55052, longitude: -46.633308),
        ),
      ),
    );

    await notifier.enableProximity();

    expect(
      notifier.state.proximityOrigin,
      const DeviceLocation(latitude: -23.55052, longitude: -46.633308),
    );
    expect(notifier.state.proximityFailure, isNull);
  });

  test('exposes a recoverable failure and leaves proximity inactive', () async {
    final notifier = ExploreNotifier(
      _LocationServiceReturning(
        const LocationUnavailable(LocationFailure.denied),
      ),
    );

    await notifier.enableProximity();

    expect(notifier.state.proximityOrigin, isNull);
    expect(notifier.state.proximityFailure, LocationFailure.denied);
  });
}

class _MemoryCacheStorage extends RepositoryCacheStorage {
  const _MemoryCacheStorage();

  @override
  Future<void> clear() async {}

  @override
  Future<void> delete({required String key}) async {}

  @override
  Future<String?> read({required String key}) async => null;

  @override
  Future<void> write({required String key, required String value}) async {}
}

class _LocationServiceReturning extends LocationService {
  final LocationResult result;

  _LocationServiceReturning(this.result) : super(_UnusedLocationPlatform());

  @override
  Future<LocationResult> requestCurrentLocation() async => result;
}

class _UnusedLocationPlatform implements LocationPlatform {
  @override
  Future<LocationPermissionStatus> checkPermission() =>
      throw UnimplementedError();

  @override
  Future<DeviceLocation> getCurrentPosition() => throw UnimplementedError();

  @override
  Future<bool> isLocationServiceEnabled() => throw UnimplementedError();

  @override
  Future<LocationPermissionStatus> requestPermission() =>
      throw UnimplementedError();
}
