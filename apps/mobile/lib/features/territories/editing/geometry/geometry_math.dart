import 'dart:math' as math;

import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';

/// Pure, Mapbox-agnostic geometry helpers for the territory editor.
/// Coordinates are treated as plain 2D (lng, lat) points — territories are
/// small enough at the zoom levels this editor targets that geodesic
/// correction isn't worth the complexity.
class GeometryMath {
  GeometryMath._();

  static List<MapCoordinate> openRing(List<MapCoordinate> ring) =>
      ring.length > 1 && ring.first == ring.last
      ? ring.sublist(0, ring.length - 1)
      : ring;

  static double ringSignedArea(List<MapCoordinate> ring) {
    final points = openRing(ring);
    if (points.length < 3) return 0;
    var sum = 0.0;
    for (var i = 0; i < points.length; i++) {
      final a = points[i];
      final b = points[(i + 1) % points.length];
      sum += a.longitude * b.latitude - b.longitude * a.latitude;
    }
    return sum / 2;
  }

  static bool isClockwise(List<MapCoordinate> ring) => ringSignedArea(ring) < 0;

  /// True if any two non-adjacent edges of [ring] cross each other.
  static bool ringSelfIntersects(List<MapCoordinate> ring) {
    final points = openRing(ring);
    final n = points.length;
    if (n < 4) return false;

    for (var i = 0; i < n; i++) {
      final a1 = points[i];
      final a2 = points[(i + 1) % n];
      for (var j = i + 1; j < n; j++) {
        final sharesVertex =
            j == i || (j + 1) % n == i || (i + 1) % n == j;
        if (sharesVertex) continue;
        final b1 = points[j];
        final b2 = points[(j + 1) % n];
        if (segmentsIntersect(a1, a2, b1, b2)) return true;
      }
    }
    return false;
  }

  static bool segmentsIntersect(
    MapCoordinate p1,
    MapCoordinate p2,
    MapCoordinate p3,
    MapCoordinate p4,
  ) {
    final d1 = _cross(p3, p4, p1);
    final d2 = _cross(p3, p4, p2);
    final d3 = _cross(p1, p2, p3);
    final d4 = _cross(p1, p2, p4);

    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
        ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
      return true;
    }
    if (d1 == 0 && _onSegment(p3, p4, p1)) return true;
    if (d2 == 0 && _onSegment(p3, p4, p2)) return true;
    if (d3 == 0 && _onSegment(p1, p2, p3)) return true;
    if (d4 == 0 && _onSegment(p1, p2, p4)) return true;
    return false;
  }

  static double _cross(MapCoordinate a, MapCoordinate b, MapCoordinate c) {
    return (b.longitude - a.longitude) * (c.latitude - a.latitude) -
        (b.latitude - a.latitude) * (c.longitude - a.longitude);
  }

  static bool _onSegment(MapCoordinate a, MapCoordinate b, MapCoordinate p) {
    return p.longitude >= math.min(a.longitude, b.longitude) &&
        p.longitude <= math.max(a.longitude, b.longitude) &&
        p.latitude >= math.min(a.latitude, b.latitude) &&
        p.latitude <= math.max(a.latitude, b.latitude);
  }

  static bool pointInPolygon(MapCoordinate point, List<MapCoordinate> ring) {
    final points = openRing(ring);
    var inside = false;
    for (var i = 0, j = points.length - 1; i < points.length; j = i++) {
      final a = points[i];
      final b = points[j];
      final crosses =
          (a.latitude > point.latitude) != (b.latitude > point.latitude);
      if (!crosses) continue;
      final xAtLatitude =
          (b.longitude - a.longitude) *
              (point.latitude - a.latitude) /
              (b.latitude - a.latitude) +
          a.longitude;
      if (point.longitude < xAtLatitude) inside = !inside;
    }
    return inside;
  }

  static MapCoordinate nearestPointOnSegment(
    MapCoordinate p,
    MapCoordinate a,
    MapCoordinate b,
  ) {
    final dx = b.longitude - a.longitude;
    final dy = b.latitude - a.latitude;
    final lengthSquared = dx * dx + dy * dy;
    if (lengthSquared == 0) return a;
    var t =
        ((p.longitude - a.longitude) * dx + (p.latitude - a.latitude) * dy) /
        lengthSquared;
    t = t.clamp(0.0, 1.0);
    return MapCoordinate(
      longitude: a.longitude + t * dx,
      latitude: a.latitude + t * dy,
    );
  }

  static MapCoordinate midpoint(MapCoordinate a, MapCoordinate b) {
    return MapCoordinate(
      longitude: (a.longitude + b.longitude) / 2,
      latitude: (a.latitude + b.latitude) / 2,
    );
  }

  /// Coarse "do these two simple rings overlap" check used for the live
  /// neighbor-overlap flag: true if any edges cross, or one ring sits
  /// fully inside the other. Good enough to *flag* an overlap; resolving
  /// it by clipping against the neighbor is a stage-3 concern (`clipper2`).
  static bool ringsOverlap(List<MapCoordinate> a, List<MapCoordinate> b) {
    final pointsA = openRing(a);
    final pointsB = openRing(b);
    if (pointsA.length < 3 || pointsB.length < 3) return false;

    for (var i = 0; i < pointsA.length; i++) {
      final a1 = pointsA[i];
      final a2 = pointsA[(i + 1) % pointsA.length];
      for (var j = 0; j < pointsB.length; j++) {
        final b1 = pointsB[j];
        final b2 = pointsB[(j + 1) % pointsB.length];
        if (segmentsIntersect(a1, a2, b1, b2)) return true;
      }
    }
    return pointInPolygon(pointsA.first, pointsB) ||
        pointInPolygon(pointsB.first, pointsA);
  }
}
