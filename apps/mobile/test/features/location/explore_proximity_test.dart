import 'package:atlasmed_mobile_app/features/explore/presentation/providers/explore_provider.dart';
import 'package:atlasmed_mobile_app/features/location/data/location_service.dart';
import 'package:atlasmed_mobile_app/features/location/presentation/providers/location_session_provider.dart';
import 'package:atlasmed_mobile_app/repository/base_repository.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_cache_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  setUp(() {
    BaseRepository.storage = const _MemoryCacheStorage();
  });

  test('syncOrigin stores session location for API geo queries', () {
    final container = ProviderContainer(
      overrides: [
        locationPlatformProvider.overrideWithValue(
          _FakeLocationPlatform(
            position: const DeviceLocation(
              latitude: -23.55052,
              longitude: -46.633308,
            ),
          ),
        ),
      ],
    );
    addTearDown(container.dispose);

    final notifier = container.read(exploreProvider.notifier);
    notifier.syncOrigin(
      const DeviceLocation(latitude: -23.55052, longitude: -46.633308),
      refetch: false,
    );

    expect(
      notifier.state.origin,
      const DeviceLocation(latitude: -23.55052, longitude: -46.633308),
    );
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

class _FakeLocationPlatform implements LocationPlatform {
  final DeviceLocation? position;

  _FakeLocationPlatform({this.position});

  @override
  Future<DeviceLocation> getCurrentPosition() async {
    final current = position;
    if (current == null) throw const LocationPlatformException();
    return current;
  }

  @override
  Future<bool> isLocationServiceEnabled() async => true;

  @override
  Future<LocationPermissionStatus> checkPermission() async =>
      LocationPermissionStatus.whileInUse;

  @override
  Future<LocationPermissionStatus> requestPermission() async =>
      LocationPermissionStatus.whileInUse;

  @override
  Stream<bool> get locationServicesEnabledStream => const Stream.empty();
}
