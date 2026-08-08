import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/location/data/location_service.dart';
import 'package:atlasmed_mobile_app/features/map/presentation/utils/map_pin_distance.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('leaves distance alone when origin is null', () {
    final points = [
      const NearbyEstablishment(
        id: 1,
        name: 'A',
        latitude: -23.565,
        longitude: -46.6925,
        distanceKm: 0,
      ),
    ];
    expect(withDistanceFromOrigin(points, null), same(points));
  });

  test('computes km from origin (Pinheiros → Itaim ~2–3 km)', () {
    const origin = DeviceLocation(latitude: -23.5650, longitude: -46.6925);
    final points = [
      const NearbyEstablishment(
        id: 1,
        name: 'Pinheiros',
        latitude: -23.5650,
        longitude: -46.6925,
        distanceKm: 0,
      ),
      const NearbyEstablishment(
        id: 2,
        name: 'Itaim',
        latitude: -23.5850,
        longitude: -46.6775,
        distanceKm: 0,
      ),
    ];

    final enriched = withDistanceFromOrigin(points, origin);
    expect(enriched[0].distanceKm, closeTo(0, 0.05));
    expect(enriched[1].distanceKm, greaterThan(2));
    expect(enriched[1].distanceKm, lessThan(4));
  });
}
