import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/geometry/geometry_math.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/geometry/geometry_ops.dart';
import 'package:flutter_test/flutter_test.dart';

MapCoordinate _c(double lng, double lat) =>
    MapCoordinate(longitude: lng, latitude: lat);

List<MapCoordinate> _square(double x0, double y0, double x1, double y1) => [
  _c(x0, y0),
  _c(x1, y0),
  _c(x1, y1),
  _c(x0, y1),
];

double _area(List<MapCoordinate> ring) =>
    GeometryMath.ringSignedArea(ring).abs();

/// True if [point] is covered by [part] — inside the exterior ring (index
/// 0) and not inside any of its holes (index 1+).
bool _covered(List<List<MapCoordinate>> part, MapCoordinate point) {
  if (!GeometryMath.pointInPolygon(point, part.first)) return false;
  for (final hole in part.skip(1)) {
    if (GeometryMath.pointInPolygon(point, hole)) return false;
  }
  return true;
}

void main() {
  group('toClipperPath / fromClipperPath', () {
    test('round trips coordinates through the integer scale', () {
      final ring = _square(0, 0, 10, 10);
      final path = GeometryOps.toClipperPath(ring);
      final back = GeometryOps.fromClipperPath(path);
      expect(back, ring);
    });

    test('drops an explicit closing point before converting', () {
      final closed = [..._square(0, 0, 10, 10), _c(0, 0)];
      final path = GeometryOps.toClipperPath(closed);
      expect(path.length, 4);
    });
  });

  group('intersects', () {
    test('true for overlapping shapes', () {
      expect(
        GeometryOps.intersects(
          _square(0, 0, 10, 10),
          _square(5, 5, 15, 15),
        ),
        isTrue,
      );
    });

    test('false for disjoint shapes', () {
      expect(
        GeometryOps.intersects(
          _square(0, 0, 10, 10),
          _square(100, 100, 110, 110),
        ),
        isFalse,
      );
    });
  });

  group('union', () {
    test('merges an overlapping drawn ring into the existing part', () {
      final parts = [
        [_square(0, 0, 10, 10)],
      ];
      final result = GeometryOps.union(parts, _square(5, 0, 15, 10));

      expect(result.length, 1);
      expect(_area(result.first.first), closeTo(150, 0.001));
      expect(_covered(result.first, _c(2, 5)), isTrue); // only in A
      expect(_covered(result.first, _c(12, 5)), isTrue); // only in drawn
      expect(_covered(result.first, _c(20, 20)), isFalse);
    });

    test('appends a disjoint drawn ring as a new part, untouched', () {
      final parts = [
        [_square(0, 0, 10, 10)],
      ];
      final drawn = _square(100, 100, 110, 110);
      final result = GeometryOps.union(parts, drawn);

      expect(result.length, 2);
      expect(identical(result.first, parts.first), isTrue);
      expect(result[1], [drawn]);
    });

    test('merges into whichever of several parts the ring overlaps', () {
      final parts = [
        [_square(0, 0, 10, 10)],
        [_square(100, 100, 110, 110)],
      ];
      final result = GeometryOps.union(parts, _square(5, 0, 15, 10));

      expect(result.length, 2);
      // The untouched far-away part is passed through unchanged.
      expect(identical(result[0], parts[1]), isTrue);
      expect(_area(result[1].first), closeTo(150, 0.001));
    });
  });

  group('difference', () {
    test('cuts a hole when the drawn ring is fully interior', () {
      final parts = [
        [_square(0, 0, 10, 10)],
      ];
      final result = GeometryOps.difference(parts, _square(3, 3, 6, 6));

      expect(result.length, 1);
      expect(result.first.length, 2); // exterior + hole
      expect(_covered(result.first, _c(4, 4)), isFalse); // inside the cut
      expect(_covered(result.first, _c(1, 1)), isTrue);
      expect(_covered(result.first, _c(8, 8)), isTrue);
    });

    test('splits a part into two when the cut crosses end-to-end', () {
      final parts = [
        [_square(0, 0, 10, 10)],
      ];
      final result = GeometryOps.difference(parts, _square(4, -1, 6, 11));

      expect(result.length, 2);
      final totalArea = result.fold<double>(
        0,
        (sum, part) => sum + _area(part.first),
      );
      expect(totalArea, closeTo(80, 0.001));
      expect(_covered(result[0], _c(1, 5)) || _covered(result[1], _c(1, 5)), isTrue);
      expect(_covered(result[0], _c(9, 5)) || _covered(result[1], _c(9, 5)), isTrue);
      expect(_covered(result[0], _c(5, 5)), isFalse);
      expect(_covered(result[1], _c(5, 5)), isFalse);
    });

    test('removes the part entirely when the cut fully covers it', () {
      final parts = [
        [_square(0, 0, 10, 10)],
      ];
      final result = GeometryOps.difference(parts, _square(-1, -1, 11, 11));

      expect(result, isEmpty);
    });

    test('leaves non-overlapping parts untouched', () {
      final parts = [
        [_square(0, 0, 10, 10)],
      ];
      final result = GeometryOps.difference(
        parts,
        _square(100, 100, 110, 110),
      );

      expect(result.length, 1);
      expect(identical(result.first, parts.first), isTrue);
    });
  });

  group('subtractShape', () {
    test('a hole in the clip shape still leaves room for the subject', () {
      final parts = [
        [_square(0, 0, 20, 20)],
      ];
      // A neighbor shaped like a ring: a square with a smaller square
      // hole in its middle. Subtracting it should only remove the donut
      // body, not the hole in its middle — that hole is free space this
      // territory can keep (or grow into).
      final neighborShape = [
        _square(5, -5, 25, 15),
        _square(10, 0, 20, 10),
      ];

      final result = GeometryOps.subtractShape(parts, neighborShape);

      bool coveredByAny(MapCoordinate point) =>
          result.any((part) => _covered(part, point));

      expect(coveredByAny(_c(1, 1)), isTrue); // untouched corner
      expect(coveredByAny(_c(15, 5)), isTrue); // neighbor's hole
      expect(coveredByAny(_c(7, 7)), isFalse); // neighbor's body
    });
  });
}
