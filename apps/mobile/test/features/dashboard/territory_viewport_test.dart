import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_metrics.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/widgets/dashboard_territory_card.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart';

/// The framing of the território mini-map.
///
/// The camera was computed once, into a `late final`, and the card kept it for
/// the life of the screen. Changing a filter replaced the zones — the platform
/// view is keyed on their ids — but handed the new view the first filter's
/// camera, so choosing Rio de Janeiro drew the RJ zone under a camera still
/// fitted to the Amazon.
///
/// Asserted on the camera rather than on pixels: a Mapbox platform view renders
/// nothing in a widget test, and the defect was never in the drawing.

/// A square degree centred on the point, in the shape the API sends.
DashboardTerritoryFeature zone(int id, String name, double lng, double lat) {
  return DashboardTerritoryFeature(
    id: id,
    name: name,
    boundary: {
      'type': 'Polygon',
      'coordinates': [
        [
          [lng - 1, lat - 1],
          [lng + 1, lat - 1],
          [lng + 1, lat + 1],
          [lng - 1, lat + 1],
          [lng - 1, lat - 1],
        ],
      ],
    },
  );
}

CameraViewportState camera(List<DashboardTerritoryFeature> features) =>
    territoryViewport(features) as CameraViewportState;

void main() {
  group('territoryViewport', () {
    final norte = zone(1, 'Norte', -60, -3);
    final rio = zone(2, 'Rio de Janeiro', -43, -22);

    test('centres on the only zone it was given', () {
      final position = camera([rio]).center!.coordinates;

      expect(position.lng, closeTo(-43, 0.001));
      expect(position.lat, closeTo(-22, 0.001));
    });

    test('a narrowed zone set moves the camera', () {
      // The defect exactly: both of these came back identical, because the
      // first one computed was the only one ever used.
      final wide = camera([norte, rio]).center!.coordinates;
      final narrow = camera([rio]).center!.coordinates;

      expect(narrow.lng, isNot(closeTo(wide.lng.toDouble(), 1.0)));
    });

    test('a narrowed zone set zooms in', () {
      // Two zones 17° apart have to be framed further out than one of them.
      expect(camera([rio]).zoom!, greaterThan(camera([norte, rio]).zoom!));
    });

    test('falls back to a Brazil overview when no zone has a boundary', () {
      final position = camera([
        const DashboardTerritoryFeature(id: 9, name: 'Sem geometria'),
      ]).center!.coordinates;

      expect(position.lng, closeTo(-51.9, 0.001));
      expect(position.lat, closeTo(-14.2, 0.001));
    });

    test('an empty zone set is the same overview, not a crash', () {
      expect(camera(const []).zoom, 3.2);
    });
  });
}
