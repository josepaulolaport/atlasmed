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

  /// The Explorar screen re-reads GPS every 90 seconds. The lists are ordered by
  /// distance from the origin, so a rep who has not moved gets back the page
  /// they are already looking at — and both tabs are invalidated, so each tick
  /// cost two requests against the two slowest endpoints, indefinitely.
  ///
  /// `origin` stands in for "did it refetch": `syncOrigin` writes the origin and
  /// invalidates the pages in the same branch, so an unchanged origin means the
  /// guard returned before either happened. It is a proxy, not a request count.
  group('the periodic GPS tick', () {
    const start = DeviceLocation(latitude: -23.55052, longitude: -46.633308);
    // ~100 m north — under the 150 m the app already calls meaningful.
    const nudge = DeviceLocation(latitude: -23.54962, longitude: -46.633308);
    // ~500 m north.
    const moved = DeviceLocation(latitude: -23.54602, longitude: -46.633308);

    ({ProviderContainer container, _FakeLocationPlatform gps}) harness() {
      final gps = _FakeLocationPlatform(position: start);
      final container = ProviderContainer(
        overrides: [locationPlatformProvider.overrideWithValue(gps)],
      );
      addTearDown(container.dispose);
      container
          .read(exploreProvider.notifier)
          .syncOrigin(start, refetch: false);
      return (container: container, gps: gps);
    }

    test('does not reload when the rep has not meaningfully moved', () async {
      final h = harness();
      h.gps.position = nudge;

      await h.container
          .read(exploreProvider.notifier)
          .refreshGpsAndList(onlyIfMoved: true);

      expect(h.container.read(exploreProvider).origin, start);
    });

    test('reloads once the rep has actually moved', () async {
      final h = harness();
      h.gps.position = moved;

      await h.container
          .read(exploreProvider.notifier)
          .refreshGpsAndList(onlyIfMoved: true);

      expect(h.container.read(exploreProvider).origin, moved);
    });

    test('an explicit pull-to-refresh reloads regardless', () async {
      // The rep asked. Standing still is not a reason to refuse them.
      final h = harness();
      h.gps.position = nudge;

      await h.container.read(exploreProvider.notifier).refreshGpsAndList();

      expect(h.container.read(exploreProvider).origin, nudge);
    });
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
  // Mutable so a test can move the phone between two revalidate() calls.
  DeviceLocation? position;

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
