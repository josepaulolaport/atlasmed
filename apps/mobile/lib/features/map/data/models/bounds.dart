import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';

class MapBounds {
  final MapCoordinate southwest;
  final MapCoordinate northeast;

  const MapBounds({required this.southwest, required this.northeast});

  @override
  bool operator ==(Object other) =>
      other is MapBounds &&
      other.southwest == southwest &&
      other.northeast == northeast;

  @override
  int get hashCode => Object.hash(southwest, northeast);
}
