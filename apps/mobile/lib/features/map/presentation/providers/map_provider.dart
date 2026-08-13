import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/models/session.dart';
import 'package:atlasmed_mobile_app/core/session/providers/session_provider.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/core/user/vertical_scope_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/location/data/location_service.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/bounds.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/territory.dart';
import 'package:atlasmed_mobile_app/features/location/presentation/providers/location_session_provider.dart';
import 'package:atlasmed_mobile_app/features/map/data/repositories/map_facility_points_repository.dart';
import 'package:atlasmed_mobile_app/features/map/data/repositories/map_repository.dart';
import 'package:atlasmed_mobile_app/features/map/presentation/utils/map_pin_distance.dart';
import 'package:atlasmed_mobile_app/features/profile/presentation/providers/profile_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Emits on login/logout/token rotate — [sessionProvider] alone never does.
final mapSessionProvider = StreamProvider<Session?>((ref) {
  return ref.watch(sessionProvider).dataStream;
});

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

/// Current visible map rectangle. Pins are not requested until Mapbox reports
/// a settled viewport, and every pan/zoom replaces this value.
final mapViewportBoundsProvider = StateProvider<MapBounds?>((ref) => null);

/// Bump to force a re-fetch of map pins (refresh button).
final mapFacilityPointsRefreshProvider = StateProvider<int>((ref) => 0);

/// Raw in-scope thin map pins (no distance). Reloads on user / vertical /
/// refresh and whenever the settled visible viewport changes.
///
/// Invalidates via [mapSessionProvider] (session dataStream). Watching
/// [sessionProvider] alone is a no-op — it is a singleton instance — which
/// left Adriana seeing another user's Hive FeatureCollection.
final liveMapFacilityPointsProvider = FutureProvider<List<NearbyEstablishment>>(
  (ref) async {
    ref.watch(mapFacilityPointsRefreshProvider);
    final bounds = ref.watch(mapViewportBoundsProvider);
    if (bounds == null) return const [];
    final session = await ref.watch(mapSessionProvider.future);
    if (session == null) return const [];
    final verticalId = await ref.watch(
      effectiveFacilityVerticalIdProvider.future,
    );
    // Tag Hive by token so account switches never reuse another user's FC.
    return fetchMapFacilityPoints(
      verticalId: verticalId,
      bounds: bounds,
      cacheTag: 'tok-${session.token.hashCode}',
    );
  },
);

/// Map pins with distance from the current location session origin.
///
/// `GET /map/facilities/points` never returns `distanceKm` (no user lat/lng),
/// so callouts used to show `0.0 km` for every clinic.
final liveMapFacilityPointsWithDistanceProvider =
    Provider<AsyncValue<List<NearbyEstablishment>>>((ref) {
      final origin = ref.watch(locationSessionProvider).location;
      return ref
          .watch(liveMapFacilityPointsProvider)
          .whenData((points) => withDistanceFromOrigin(points, origin));
    });
