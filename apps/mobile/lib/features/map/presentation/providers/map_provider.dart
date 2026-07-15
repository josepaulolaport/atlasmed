import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/models.dart';
import 'package:atlasmed_mobile_app/features/location/data/location_service.dart';
import 'package:atlasmed_mobile_app/core/session/providers/session_provider.dart';
import 'package:atlasmed_mobile_app/features/map/data/repositories/map_repository.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final currentLocationServiceProvider = Provider<CurrentLocationService>((ref) {
  final platform = GeolocatorLocationPlatform();
  final service = LocationService(platform);
  return DeviceCurrentLocationService(service);
});

final mapRepositoryProvider = Provider<MapRepository>((ref) {
  final assignmentsRepo = ref.watch(userAssignmentsProvider);
  return MapRepository(
    assignmentsRepo: assignmentsRepo,
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
