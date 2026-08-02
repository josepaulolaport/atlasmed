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

  /// Parses the raw `{type, coordinates}` GeoJSON the API returns from
  /// `GET/PUT /territories/:id/boundary` — nesting depth differs between
  /// `Polygon` (rings of points) and `MultiPolygon` (polygons of rings of
  /// points), so both are normalized into this model's uniform
  /// "polygons of rings of points" shape.
  ///
  /// Rejects non-polygon types (e.g. LineString) — feeding those into a
  /// Mapbox FillLayer triggers `FillBucket: adding non-polygon geometry`.
  factory TerritoryGeometry.fromGeoJson(Map<String, dynamic> json) {
    final parsed = tryFromGeoJson(json);
    if (parsed == null) {
      throw FormatException(
        'Expected Polygon/MultiPolygon with valid rings, got ${json['type']}',
      );
    }
    return parsed;
  }

  /// Like [fromGeoJson] but returns `null` for LineString / empty / degenerate.
  static TerritoryGeometry? tryFromGeoJson(Map<String, dynamic> json) {
    final type = json['type'] as String?;
    final raw = json['coordinates'];
    if (raw is! List<dynamic>) return null;

    List<MapCoordinate> parseRing(List<dynamic> ring) => ring
        .map(
          (point) => MapCoordinate(
            longitude: (point[0] as num).toDouble(),
            latitude: (point[1] as num).toDouble(),
          ),
        )
        .toList();

    List<List<MapCoordinate>> parsePolygon(List<dynamic> polygon) =>
        polygon.map((ring) => parseRing(ring as List<dynamic>)).toList();

    final TerritoryGeometry rawGeom;
    if (type == 'MultiPolygon') {
      rawGeom = TerritoryGeometry._(
        type: 'MultiPolygon',
        coordinates: raw
            .map((polygon) => parsePolygon(polygon as List<dynamic>))
            .toList(),
      );
    } else if (type == 'Polygon') {
      rawGeom = TerritoryGeometry._(
        type: 'Polygon',
        coordinates: [parsePolygon(raw)],
      );
    } else {
      return null;
    }
    return rawGeom.sanitized();
  }

  /// Drops empty / collinear / open-degenerate rings so FillLayers never see
  /// LineString-shaped geometry. Returns `null` when nothing fillable remains.
  TerritoryGeometry? sanitized() {
    final polygons = <List<List<MapCoordinate>>>[];
    for (final polygon in coordinates) {
      final rings = <List<MapCoordinate>>[];
      for (final ring in polygon) {
        final closed = _closedFillableRing(ring);
        if (closed != null) rings.add(closed);
      }
      if (rings.isNotEmpty) polygons.add(rings);
    }
    if (polygons.isEmpty) return null;
    if (polygons.length == 1) {
      return TerritoryGeometry.polygon(polygons.first);
    }
    return TerritoryGeometry.multiPolygon(polygons);
  }

  /// Closed ring with ≥3 distinct vertices and non-zero area, else null.
  static List<MapCoordinate>? _closedFillableRing(List<MapCoordinate> ring) {
    if (ring.length < 3) return null;

    final deduped = <MapCoordinate>[];
    for (final point in ring) {
      if (deduped.isEmpty ||
          deduped.last.longitude != point.longitude ||
          deduped.last.latitude != point.latitude) {
        deduped.add(point);
      }
    }
    if (deduped.length >= 2 &&
        deduped.first.longitude == deduped.last.longitude &&
        deduped.first.latitude == deduped.last.latitude) {
      deduped.removeLast();
    }
    if (deduped.length < 3) return null;

    final closed = [...deduped, deduped.first];
    // Shoelace on closed ring; reject collinear / zero-area.
    var sum = 0.0;
    for (var i = 0; i < closed.length - 1; i++) {
      sum +=
          closed[i].longitude * closed[i + 1].latitude -
          closed[i + 1].longitude * closed[i].latitude;
    }
    if (sum.abs() < 1e-18) return null;
    return closed;
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
    final safe = sanitized() ?? this;
    return {
      'type': 'FeatureCollection',
      'features': [
        {
          'type': 'Feature',
          'properties': <String, Object?>{},
          'geometry': safe.toGeoJson(),
        },
      ],
    };
  }

  /// Raw `{type, coordinates}` GeoJSON, the shape the API expects for
  /// `POST /territories` (`boundary`) and `PUT /territories/:id/boundary` —
  /// the inverse of [TerritoryGeometry.fromGeoJson].
  Map<String, Object?> toGeoJson() {
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
    return {'type': type, 'coordinates': geometryCoordinates};
  }
}
