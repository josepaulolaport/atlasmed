import 'coordinate.dart';
import 'facility.dart';
import 'territory.dart';

class MapData {
  final MapCoordinate userLocation;
  final TerritoryGeometry? territory;
  final List<MapFacility> facilities;

  const MapData({
    required this.userLocation,
    this.territory,
    this.facilities = const [],
  });
}
