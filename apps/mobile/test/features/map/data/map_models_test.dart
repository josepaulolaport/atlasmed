import 'package:atlasmed_mobile_app/features/map/data/models/models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('TerritoryGeometry', () {
    test('builds a valid Polygon GeoJSON feature collection', () {
      final geometry = TerritoryGeometry.polygon([
        [
          MapCoordinate(longitude: -46.64, latitude: -23.55),
          MapCoordinate(longitude: -46.63, latitude: -23.55),
          MapCoordinate(longitude: -46.63, latitude: -23.54),
          MapCoordinate(longitude: -46.64, latitude: -23.55),
        ],
      ]);

      expect(geometry.toFeatureCollection(), {
        'type': 'FeatureCollection',
        'features': [
          {
            'type': 'Feature',
            'properties': <String, Object?>{},
            'geometry': {
              'type': 'Polygon',
              'coordinates': [
                [
                  [-46.64, -23.55],
                  [-46.63, -23.55],
                  [-46.63, -23.54],
                  [-46.64, -23.55],
                ],
              ],
            },
          },
        ],
      });
    });

    test('returns null bounds for an empty geometry', () {
      final geometry = TerritoryGeometry.multiPolygon([]);

      expect(geometry.bounds, isNull);
    });

    test('calculates bounds across a multipolygon', () {
      final geometry = TerritoryGeometry.multiPolygon([
        [
          [
            MapCoordinate(longitude: -47, latitude: -24),
            MapCoordinate(longitude: -46, latitude: -23),
          ],
        ],
        [
          [
            MapCoordinate(longitude: -45, latitude: -22),
            MapCoordinate(longitude: -44, latitude: -21),
          ],
        ],
      ]);

      expect(
        geometry.bounds,
        const MapBounds(
          southwest: MapCoordinate(longitude: -47, latitude: -24),
          northeast: MapCoordinate(longitude: -44, latitude: -21),
        ),
      );
    });
  });
}
