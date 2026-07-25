import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/providers/session_provider.dart';
import 'package:atlasmed_mobile_app/core/user/vertical_scope_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_nearby_repository.dart';
import 'package:atlasmed_mobile_app/features/location/data/location_service.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/territory.dart';
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

/// Optional territory polygon for the live map overlay. Missing territory
/// must not block the map — clinics still load around the user.
final mapTerritoryProvider = FutureProvider<TerritoryGeometry?>((ref) async {
  return ref.watch(mapRepositoryProvider).getAssignedTerritory();
});

/// User-centered clinic search for the live map tab.
class LiveMapClinicsQuery {
  const LiveMapClinicsQuery({
    required this.latitude,
    required this.longitude,
    required this.radiusKm,
  });

  final double latitude;
  final double longitude;
  final double radiusKm;

  @override
  bool operator ==(Object other) {
    return other is LiveMapClinicsQuery &&
        other.latitude == latitude &&
        other.longitude == longitude &&
        other.radiusKm == radiusKm;
  }

  @override
  int get hashCode => Object.hash(latitude, longitude, radiusKm);
}

final liveMapClinicsProvider =
    FutureProvider.family<List<NearbyEstablishment>, LiveMapClinicsQuery>((
      ref,
      query,
    ) async {
      final verticalId = await ref.watch(effectiveFacilityVerticalIdProvider.future);
      return fetchNearbyFacilities(
        latitude: query.latitude,
        longitude: query.longitude,
        radiusKm: query.radiusKm,
        limit: 100,
        verticalId: verticalId,
      );
    });
