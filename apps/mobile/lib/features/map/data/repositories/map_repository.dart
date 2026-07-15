import '../models/models.dart';

/// One-shot location port. Its platform implementation must request permission
/// once and never subscribe to location updates.
abstract interface class CurrentLocationService {
  Future<MapCoordinate> getCurrentLocation();
}

/// Map-specific API seam. Facility responses must already be scope-filtered by
/// the backend; the mobile client never attempts to widen a territory scope.
abstract interface class MapRepository {
  Future<List<MapFacility>> getNearbyFacilities();
  Future<TerritoryGeometry?> getAssignedTerritory();
}

class MapData {
  final MapCoordinate userLocation;
  final TerritoryGeometry? territory;
  final List<MapFacility> facilities;

  const MapData({
    required this.userLocation,
    required this.territory,
    required this.facilities,
  });
}
