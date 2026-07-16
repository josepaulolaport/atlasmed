import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/geometry/geometry_math.dart';
import 'package:flutter_test/flutter_test.dart';

MapCoordinate _c(double lng, double lat) =>
    MapCoordinate(longitude: lng, latitude: lat);

void main() {
  group('GeometryMath.ringSelfIntersects', () {
    test('false for a simple square', () {
      final ring = [_c(0, 0), _c(1, 0), _c(1, 1), _c(0, 1)];
      expect(GeometryMath.ringSelfIntersects(ring), isFalse);
    });

    test('true for a bowtie / figure-eight ring', () {
      final ring = [_c(0, 0), _c(1, 1), _c(1, 0), _c(0, 1)];
      expect(GeometryMath.ringSelfIntersects(ring), isTrue);
    });

    test('false for a triangle (below the 4-point minimum)', () {
      final ring = [_c(0, 0), _c(1, 0), _c(0.5, 1)];
      expect(GeometryMath.ringSelfIntersects(ring), isFalse);
    });
  });

  group('GeometryMath.pointInPolygon', () {
    final square = [_c(0, 0), _c(2, 0), _c(2, 2), _c(0, 2)];

    test('true for a point inside', () {
      expect(GeometryMath.pointInPolygon(_c(1, 1), square), isTrue);
    });

    test('false for a point outside', () {
      expect(GeometryMath.pointInPolygon(_c(3, 3), square), isFalse);
    });
  });

  group('GeometryMath.ringsOverlap', () {
    test('true when two squares overlap', () {
      final a = [_c(0, 0), _c(2, 0), _c(2, 2), _c(0, 2)];
      final b = [_c(1, 1), _c(3, 1), _c(3, 3), _c(1, 3)];
      expect(GeometryMath.ringsOverlap(a, b), isTrue);
    });

    test('false for two disjoint squares', () {
      final a = [_c(0, 0), _c(1, 0), _c(1, 1), _c(0, 1)];
      final b = [_c(5, 5), _c(6, 5), _c(6, 6), _c(5, 6)];
      expect(GeometryMath.ringsOverlap(a, b), isFalse);
    });

    test('true when one ring fully contains the other', () {
      final outer = [_c(0, 0), _c(5, 0), _c(5, 5), _c(0, 5)];
      final inner = [_c(1, 1), _c(2, 1), _c(2, 2), _c(1, 2)];
      expect(GeometryMath.ringsOverlap(outer, inner), isTrue);
    });
  });

  group('GeometryMath.nearestPointOnSegment', () {
    test('clamps to the nearest endpoint', () {
      final result = GeometryMath.nearestPointOnSegment(
        _c(-5, 0),
        _c(0, 0),
        _c(1, 0),
      );
      expect(result, _c(0, 0));
    });

    test('projects perpendicular onto the segment', () {
      final result = GeometryMath.nearestPointOnSegment(
        _c(0.5, 5),
        _c(0, 0),
        _c(1, 0),
      );
      expect(result.longitude, closeTo(0.5, 1e-9));
      expect(result.latitude, closeTo(0, 1e-9));
    });
  });
}
