import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/providers/session_provider.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/core/user/vertical_scope_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/location/data/location_service.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/territory.dart';
import 'package:atlasmed_mobile_app/features/map/data/repositories/map_facility_points_repository.dart';
import 'package:atlasmed_mobile_app/features/map/data/repositories/map_repository.dart';
import 'package:atlasmed_mobile_app/features/profile/presentation/providers/profile_provider.dart';
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
/// Admins never get a polygon (global view; no territory paint).
/// Wait for [currentUserProvider] so we never paint while role is unknown
/// (null user → isAdmin false → would wrongly fetch assigned territories).
final mapTerritoryProvider = FutureProvider<TerritoryGeometry?>((ref) async {
  final user = await ref.watch(currentUserProvider.future);
  if (user == null || user.role.name == UserRoleName.admin) return null;
  return ref.watch(mapRepositoryProvider).getAssignedTerritory();
});

/// Bump to force a re-fetch of map pins (refresh button).
final mapFacilityPointsRefreshProvider = StateProvider<int>((ref) => 0);

/// All in-scope thin map pins. Reloads on vertical change / refresh bump /
/// session change — not on pan/zoom.
final liveMapFacilityPointsProvider = FutureProvider<List<NearbyEstablishment>>(
  (ref) async {
    ref.watch(sessionProvider);
    ref.watch(mapFacilityPointsRefreshProvider);
    final verticalId = await ref.watch(
      effectiveFacilityVerticalIdProvider.future,
    );
    return fetchMapFacilityPoints(verticalId: verticalId);
  },
);
