import 'package:atlasmed_mobile_app/features/users/data/models/assignment_option.dart';
import 'package:flutter_test/flutter_test.dart';

/// The polygon `GET /access/users/:id/assignments` actually sends.
const _boundary = {
  'type': 'Polygon',
  'coordinates': [
    [
      [-46.7, -23.6],
      [-46.5, -23.6],
      [-46.5, -23.4],
      [-46.7, -23.4],
      [-46.7, -23.6],
    ],
  ],
};

void main() {
  test('a territory with a boundary and no centroid still has somewhere to '
      'point the camera', () {
    // The route sends `boundary` and never `centroid`, and the map card
    // refuses to render without one — so every territory minimap on the user
    // detail screen was a grey placeholder with the geometry sitting right
    // there unused.
    final option = TerritoryOption.fromJson(const {
      'id': 3,
      'name': 'Patch Adriana Oliveira',
      'boundary': _boundary,
    });

    expect(option.boundary, isNotNull);
    expect(option.centroid, isNotNull);
    expect(option.centroid!.longitude, closeTo(-46.6, 0.2));
    expect(option.centroid!.latitude, closeTo(-23.5, 0.2));
  });

  test('an explicit centroid still wins', () {
    final option = TerritoryOption.fromJson(const {
      'id': 3,
      'name': 'Patch Adriana Oliveira',
      'boundary': _boundary,
      'centroid': {'longitude': -1.0, 'latitude': 2.0},
    });

    expect(option.centroid!.longitude, -1.0);
    expect(option.centroid!.latitude, 2.0);
  });

  test('no boundary and no centroid stays null', () {
    final option = TerritoryOption.fromJson(const {
      'id': 3,
      'name': 'Sem área',
    });

    expect(option.centroid, isNull);
  });
}
