import 'package:atlasmed_mobile_app/features/map/data/models/bounds.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';

class TerritoryGeometry {
  final String type;
  final List<List<List<MapCoordinate>>> coordinates;

  const TerritoryGeometry._({required this.type, required this.coordinates});

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

  /// A single representative point to anchor a label/callout — the centroid
  /// of the largest polygon part. A territory can be made of multiple
  /// disjoint polygons (e.g. an exclave), so a naive average of every
  /// vertex could land outside all of them; anchoring to the biggest part
  /// keeps the label inside actual territory.
  MapCoordinate? get labelAnchor {
    List<MapCoordinate>? largestRing;
    var largestArea = -1.0;

    for (final polygon in coordinates) {
      if (polygon.isEmpty) continue;
      final outerRing = polygon.first;
      final area = _ringArea(outerRing).abs();
      if (area > largestArea) {
        largestArea = area;
        largestRing = outerRing;
      }
    }

    if (largestRing == null || largestRing.isEmpty) return null;
    return _ringCentroid(largestRing);
  }

  double _ringArea(List<MapCoordinate> ring) {
    var sum = 0.0;
    for (var i = 0; i < ring.length - 1; i++) {
      sum +=
          ring[i].longitude * ring[i + 1].latitude -
          ring[i + 1].longitude * ring[i].latitude;
    }
    return sum / 2;
  }

  MapCoordinate _ringCentroid(List<MapCoordinate> ring) {
    final points = ring.length > 1 && ring.first == ring.last
        ? ring.sublist(0, ring.length - 1)
        : ring;
    final lat =
        points.map((p) => p.latitude).reduce((a, b) => a + b) / points.length;
    final lng =
        points.map((p) => p.longitude).reduce((a, b) => a + b) / points.length;
    return MapCoordinate(latitude: lat, longitude: lng);
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
