import 'coordinate.dart';

class MapFacility {
  final String id;
  final String name;
  final MapCoordinate coordinate;
  final double distanceKm;

  const MapFacility({
    required this.id,
    required this.name,
    required this.coordinate,
    this.distanceKm = 0,
  });
}
