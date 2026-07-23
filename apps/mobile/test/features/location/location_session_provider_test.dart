import 'dart:async';

import 'package:atlasmed_mobile_app/features/location/data/location_service.dart';
import 'package:atlasmed_mobile_app/features/location/presentation/providers/location_session_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('ensureLocation sets ready when platform returns a fix', () async {
    final platform = _FakeLocationPlatform(
      position: const DeviceLocation(latitude: -23.55, longitude: -46.63),
    );
    final container = ProviderContainer(
      overrides: [locationPlatformProvider.overrideWithValue(platform)],
    );
    addTearDown(container.dispose);

    await container.read(locationSessionProvider.notifier).ensureLocation();

    final state = container.read(locationSessionProvider);
    expect(state.phase, LocationSessionPhase.ready);
    expect(state.isUsable, isTrue);
    expect(state.location?.latitude, -23.55);
  });

  test('ensureLocation sets blocked when services are disabled', () async {
    final platform = _FakeLocationPlatform(serviceEnabled: false);
    final container = ProviderContainer(
      overrides: [locationPlatformProvider.overrideWithValue(platform)],
    );
    addTearDown(container.dispose);

    await container.read(locationSessionProvider.notifier).ensureLocation();

    final state = container.read(locationSessionProvider);
    expect(state.phase, LocationSessionPhase.blocked);
    expect(state.isUsable, isFalse);
    expect(state.failure, LocationFailure.serviceDisabled);
  });

  test('service-disabled stream blocks an already-ready session', () async {
    final services = StreamController<bool>.broadcast();
    final platform = _FakeLocationPlatform(
      position: const DeviceLocation(latitude: -23.55, longitude: -46.63),
      servicesStream: services.stream,
    );
    final container = ProviderContainer(
      overrides: [locationPlatformProvider.overrideWithValue(platform)],
    );
    addTearDown(() async {
      await services.close();
      container.dispose();
    });

    final notifier = container.read(locationSessionProvider.notifier);
    await notifier.ensureLocation();
    expect(container.read(locationSessionProvider).isUsable, isTrue);

    services.add(false);
    await Future<void>.delayed(Duration.zero);

    final state = container.read(locationSessionProvider);
    expect(state.phase, LocationSessionPhase.blocked);
    expect(state.isUsable, isFalse);
    expect(state.failure, LocationFailure.serviceDisabled);
  });

  test('revalidate keeps shell usable until soft check fails', () async {
    final platform = _FakeLocationPlatform(
      position: const DeviceLocation(latitude: -23.55, longitude: -46.63),
    );
    final container = ProviderContainer(
      overrides: [locationPlatformProvider.overrideWithValue(platform)],
    );
    addTearDown(container.dispose);

    final notifier = container.read(locationSessionProvider.notifier);
    await notifier.ensureLocation();
    expect(container.read(locationSessionProvider).isUsable, isTrue);

    platform.serviceEnabled = false;
    await notifier.revalidate();

    expect(container.read(locationSessionProvider).isUsable, isFalse);
    expect(
      container.read(locationSessionProvider).failure,
      LocationFailure.serviceDisabled,
    );
  });
}

class _FakeLocationPlatform implements LocationPlatform {
  bool serviceEnabled;
  final DeviceLocation? position;
  final Stream<bool> servicesStream;

  _FakeLocationPlatform({
    this.serviceEnabled = true,
    this.position,
    Stream<bool>? servicesStream,
  }) : servicesStream = servicesStream ?? const Stream.empty();

  @override
  Future<DeviceLocation> getCurrentPosition() async {
    final current = position;
    if (current == null) throw const LocationPlatformException();
    return current;
  }

  @override
  Future<bool> isLocationServiceEnabled() async => serviceEnabled;

  @override
  Future<LocationPermissionStatus> checkPermission() async =>
      LocationPermissionStatus.whileInUse;

  @override
  Future<LocationPermissionStatus> requestPermission() async =>
      LocationPermissionStatus.whileInUse;

  @override
  Stream<bool> get locationServicesEnabledStream => servicesStream;
}
