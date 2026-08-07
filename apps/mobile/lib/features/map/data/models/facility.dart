import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';

class MapFacility {
  final int id;
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
