import 'package:flutter_test/flutter_test.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_mock.dart';

void main() {
  test('filterNearbyByRadius respects radius', () {
    final all = mockEstablishmentDetailSections(
      'facility-1',
    ).nearbyEstablishments;

    final within5 = filterNearbyByRadius(all, 5);
    expect(within5.every((e) => e.distanceKm <= 5), isTrue);
    expect(within5.length, lessThan(all.length));

    final within50 = filterNearbyByRadius(all, 50);
    expect(within50.length, all.length);
  });
}
