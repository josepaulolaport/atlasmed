import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/facility.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/territory.dart';

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
