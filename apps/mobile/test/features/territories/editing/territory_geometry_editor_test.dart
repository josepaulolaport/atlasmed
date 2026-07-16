import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/territory.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/geometry/territory_geometry_editor.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/models/editor_refs.dart';
import 'package:flutter_test/flutter_test.dart';

MapCoordinate _c(double lng, double lat) =>
    MapCoordinate(longitude: lng, latitude: lat);

void main() {
  group('fromGeometry / toGeometry round trip', () {
    test('opens a closed ring and re-closes it on export', () {
      final geometry = TerritoryGeometry.polygon([
        [_c(0, 0), _c(1, 0), _c(1, 1), _c(0, 1), _c(0, 0)],
      ]);

      final parts = TerritoryGeometryEditor.fromGeometry(geometry);
      expect(parts, [
        [
          [_c(0, 0), _c(1, 0), _c(1, 1), _c(0, 1)],
        ],
      ]);

      final rebuilt = TerritoryGeometryEditor.toGeometry(parts);
      expect(rebuilt.type, 'Polygon');
      expect(rebuilt.coordinates.first.first.last, _c(0, 0));
    });

    test('picks MultiPolygon type once there is more than one part', () {
      final parts = [
        [
          [_c(0, 0), _c(1, 0), _c(1, 1)],
        ],
        [
          [_c(5, 5), _c(6, 5), _c(6, 6)],
        ],
      ];
      final geometry = TerritoryGeometryEditor.toGeometry(parts);
      expect(geometry.type, 'MultiPolygon');
      expect(geometry.coordinates.length, 2);
    });
  });

  group('moveVertex', () {
    test('replaces just the targeted point', () {
      final parts = [
        [
          [_c(0, 0), _c(1, 0), _c(1, 1)],
        ],
      ];
      final next = TerritoryGeometryEditor.moveVertex(
        parts,
        const VertexRef(partIndex: 0, ringIndex: 0, pointIndex: 1),
        _c(9, 9),
      );
      expect(next[0][0], [_c(0, 0), _c(9, 9), _c(1, 1)]);
      // original untouched
      expect(parts[0][0][1], _c(1, 0));
    });
  });

  group('insertVertex', () {
    test('inserts right after the edge start and returns its ref', () {
      final parts = [
        [
          [_c(0, 0), _c(1, 0), _c(1, 1)],
        ],
      ];
      final result = TerritoryGeometryEditor.insertVertex(
        parts,
        const EdgeRef(partIndex: 0, ringIndex: 0, startIndex: 0),
        _c(0.5, 0),
      );
      expect(result.parts[0][0], [_c(0, 0), _c(0.5, 0), _c(1, 0), _c(1, 1)]);
      expect(
        result.ref,
        const VertexRef(partIndex: 0, ringIndex: 0, pointIndex: 1),
      );
    });

    test('appends when the edge wraps from the last point to the first', () {
      final parts = [
        [
          [_c(0, 0), _c(1, 0), _c(1, 1)],
        ],
      ];
      final result = TerritoryGeometryEditor.insertVertex(
        parts,
        const EdgeRef(partIndex: 0, ringIndex: 0, startIndex: 2),
        _c(0.5, 0.5),
      );
      expect(result.parts[0][0].last, _c(0.5, 0.5));
    });
  });

  group('deleteVertex', () {
    test('removes the point when above the 3-point floor', () {
      final parts = [
        [
          [_c(0, 0), _c(1, 0), _c(1, 1), _c(0, 1)],
        ],
      ];
      final next = TerritoryGeometryEditor.deleteVertex(
        parts,
        const VertexRef(partIndex: 0, ringIndex: 0, pointIndex: 1),
      );
      expect(next, isNotNull);
      expect(next![0][0], [_c(0, 0), _c(1, 1), _c(0, 1)]);
    });

    test('refuses to drop a ring below a triangle', () {
      final parts = [
        [
          [_c(0, 0), _c(1, 0), _c(1, 1)],
        ],
      ];
      final next = TerritoryGeometryEditor.deleteVertex(
        parts,
        const VertexRef(partIndex: 0, ringIndex: 0, pointIndex: 0),
      );
      expect(next, isNull);
    });
  });

  group('moveEdge', () {
    test('translates both endpoints of the edge by the same delta', () {
      final parts = [
        [
          [_c(0, 0), _c(1, 0), _c(1, 1), _c(0, 1)],
        ],
      ];
      final next = TerritoryGeometryEditor.moveEdge(
        parts,
        const EdgeRef(partIndex: 0, ringIndex: 0, startIndex: 0),
        0.5,
        0.5,
      );
      expect(next[0][0][0], _c(0.5, 0.5));
      expect(next[0][0][1], _c(1.5, 0.5));
      expect(next[0][0][2], _c(1, 1));
      expect(next[0][0][3], _c(0, 1));
    });
  });

  group('movePolygon', () {
    test('translates every point of every ring in the part', () {
      final parts = [
        [
          [_c(0, 0), _c(1, 0), _c(1, 1)],
          [_c(0.2, 0.2), _c(0.4, 0.2), _c(0.4, 0.4)],
        ],
      ];
      final next = TerritoryGeometryEditor.movePolygon(parts, 0, 1, 1);
      expect(next[0][0], [_c(1, 1), _c(2, 1), _c(2, 2)]);
      expect(next[0][1], [_c(1.2, 1.2), _c(1.4, 1.2), _c(1.4, 1.4)]);
    });
  });

  group('deletePart / appendPart', () {
    test('deletePart removes exactly the targeted part', () {
      final parts = [
        [
          [_c(0, 0), _c(1, 0), _c(1, 1)],
        ],
        [
          [_c(5, 5), _c(6, 5), _c(6, 6)],
        ],
      ];
      final next = TerritoryGeometryEditor.deletePart(parts, 0);
      expect(next.length, 1);
      expect(next[0][0], [_c(5, 5), _c(6, 5), _c(6, 6)]);
    });

    test('appendPart adds a new disconnected part', () {
      final parts = [
        [
          [_c(0, 0), _c(1, 0), _c(1, 1)],
        ],
      ];
      final next = TerritoryGeometryEditor.appendPart(parts, [
        _c(5, 5),
        _c(6, 5),
        _c(6, 6),
      ]);
      expect(next.length, 2);
      expect(next[1][0], [_c(5, 5), _c(6, 5), _c(6, 6)]);
    });
  });
}
