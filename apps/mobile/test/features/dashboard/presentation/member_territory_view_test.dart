import 'package:atlasmed_mobile_app/features/dashboard/presentation/widgets/member_territory_view.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/territory.dart';
import 'package:flutter_test/flutter_test.dart';

TerritoryGeometry _square(double x, double y, {List<List<double>>? hole}) {
  List<MapCoordinate> ring(List<List<double>> points) => [
    for (final p in points) MapCoordinate(longitude: p[0], latitude: p[1]),
  ];

  return TerritoryGeometry.polygon([
    ring([
      [x, y],
      [x + 1, y],
      [x + 1, y + 1],
      [x, y + 1],
      [x, y],
    ]),
    if (hole != null) ring(hole),
  ]);
}

List<dynamic> _rings(Map<String, Object?> mask) =>
    ((mask['geometry']! as Map<String, Object?>)['coordinates']! as List)
        .cast<dynamic>();

void main() {
  group('maskOutside (spec 0015 §6)', () {
    test('nothing to exclude means nothing to dim', () {
      // Drawing a full-world scrim with no holes would black out the map. An
      // admin looking at a manager has no enclosing zone, and that is the case
      // this guards.
      expect(maskOutside(const []), isNull);
    });

    test('the outer ring is the world, and the zone is a hole in it', () {
      final mask = maskOutside([_square(0, 0)])!;
      final rings = _rings(mask);

      expect(mask['type'], 'Feature');
      expect((mask['geometry']! as Map)['type'], 'Polygon');
      // First ring is the world; everything after it is punched out.
      expect(rings.first, [
        [-180.0, -85.0],
        [180.0, -85.0],
        [180.0, 85.0],
        [-180.0, 85.0],
        [-180.0, -85.0],
      ]);
      expect(rings.length, 2);
      expect(rings[1].first, [0.0, 0.0]);
    });

    test('every polygon of a multipolygon gets its own hole', () {
      // A manager holding three zones must see all three cut out, not the
      // first one — which is what a `.first` in the wrong place would do.
      final mask = maskOutside([
        _square(0, 0),
        _square(10, 10),
        _square(20, 20),
      ])!;
      expect(_rings(mask).length, 4);
    });

    test("a zone's own holes stay dimmed", () {
      // An interior ring is ground the zone does not cover. Punching it out too
      // would present a gap in the territory as if it were part of it.
      final mask = maskOutside([
        _square(
          0,
          0,
          hole: [
            [0.2, 0.2],
            [0.8, 0.2],
            [0.8, 0.8],
            [0.2, 0.8],
            [0.2, 0.2],
          ],
        ),
      ])!;

      expect(_rings(mask).length, 2);
    });

    test('a degenerate ring is skipped rather than drawn', () {
      // Three points cannot close a polygon. Mapbox renders it as nothing, or
      // as something wrong; either way it should never reach the layer.
      final degenerate = TerritoryGeometry.polygon([
        [
          const MapCoordinate(longitude: 0, latitude: 0),
          const MapCoordinate(longitude: 1, latitude: 1),
        ],
      ]);

      expect(maskOutside([degenerate]), isNull);
    });
  });
}
