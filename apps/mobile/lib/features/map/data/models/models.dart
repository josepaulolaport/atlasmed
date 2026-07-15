/// A geographic coordinate expressed in WGS 84 longitude/latitude order.
class MapCoordinate {
  final double longitude;
  final double latitude;

  const MapCoordinate({required this.longitude, required this.latitude});

  @override
  bool operator ==(Object other) =>
      other is MapCoordinate &&
      other.longitude == longitude &&
      other.latitude == latitude;

  @override
  int get hashCode => Object.hash(longitude, latitude);
}

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

/// GeoJSON territory geometry. Coordinates are intentionally typed so callers
/// cannot accidentally send latitude/longitude in the wrong order to Mapbox.
class TerritoryGeometry {
  final String type;
  final List<List<List<MapCoordinate>>> coordinates;

  const TerritoryGeometry._({required this.type, required this.coordinates});

  /// Creates a Polygon geometry from its linear rings.
  factory TerritoryGeometry.polygon(List<List<MapCoordinate>> polygon) {
    return TerritoryGeometry._(type: 'Polygon', coordinates: [polygon]);
  }

  factory TerritoryGeometry.multiPolygon(
    List<List<List<MapCoordinate>>> multiPolygon,
  ) {
    return TerritoryGeometry._(type: 'MultiPolygon', coordinates: multiPolygon);
  }

  MapBounds? get bounds {
    final points = coordinates
        .expand((polygon) => polygon)
        .expand((ring) => ring);
    if (points.isEmpty) return null;

    var west = points.first.longitude;
    var east = west;
    var south = points.first.latitude;
    var north = south;
    for (final point in points.skip(1)) {
      west = point.longitude < west ? point.longitude : west;
      east = point.longitude > east ? point.longitude : east;
      south = point.latitude < south ? point.latitude : south;
      north = point.latitude > north ? point.latitude : north;
    }
    return MapBounds(
      southwest: MapCoordinate(longitude: west, latitude: south),
      northeast: MapCoordinate(longitude: east, latitude: north),
    );
  }

  Map<String, Object?> toFeatureCollection() {
    final geometryCoordinates = type == 'Polygon'
        ? coordinates.single
              .map(
                (ring) => ring
                    .map((point) => [point.longitude, point.latitude])
                    .toList(),
              )
              .toList()
        : coordinates
              .map(
                (polygon) => polygon
                    .map(
                      (ring) => ring
                          .map((point) => [point.longitude, point.latitude])
                          .toList(),
                    )
                    .toList(),
              )
              .toList();
    return {
      'type': 'FeatureCollection',
      'features': [
        {
          'type': 'Feature',
          'properties': <String, Object?>{},
          'geometry': {'type': type, 'coordinates': geometryCoordinates},
        },
      ],
    };
  }
}
