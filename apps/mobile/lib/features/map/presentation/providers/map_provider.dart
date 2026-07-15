import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/providers/session_provider.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment.dart';
import 'package:atlasmed_mobile_app/features/location/data/location_service.dart';
import 'package:atlasmed_mobile_app/features/map/data/repositories/map_repository.dart';
import 'package:atlasmed_mobile_app/repository/external/platform_http_client.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final currentLocationServiceProvider = Provider<CurrentLocationService>((ref) {
  final platform = GeolocatorLocationPlatform();
  final service = LocationService(platform);
  return DeviceCurrentLocationService(service);
});

final mapRepositoryProvider = Provider<MapRepository>((ref) {
  final assignmentsRepo = ref.watch(userAssignmentsProvider);
  final client = createPlatformHttpClient(tokenBuilder: () async {
    try {
      final session = await SessionEnvironment.instance.currentValueOrResolve();
      return session?.token;
    } catch (_) {
      return null;
    }
  });
  return ApiMapRepository(
    assignmentsRepo: assignmentsRepo,
    client: client,
    baseUrl: AppConfig.apiBaseUrl,
  );
});

final mapDataProvider = FutureProvider<MapData>((ref) async {
  final locationService = ref.watch(currentLocationServiceProvider);
  final repository = ref.watch(mapRepositoryProvider);

  final userLocation = await locationService.getCurrentLocation();
  final territory = await repository.getAssignedTerritory();
  if (territory == null) {
    return MapData(
      userLocation: userLocation,
      territory: null,
      facilities: const [],
    );
  }

  final facilities = await repository.getNearbyFacilities(
    userLocation.latitude,
    userLocation.longitude,
    50.0,
  );
  return MapData(
    userLocation: userLocation,
    territory: territory,
    facilities: facilities,
  );
});
