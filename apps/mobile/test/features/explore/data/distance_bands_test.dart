import 'package:atlasmed_mobile_app/features/explore/data/models/distance_bands.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('maps km cutoffs', () {
    expect(DistanceBandX.forKm(0.5), DistanceBand.veryNear);
    expect(DistanceBandX.forKm(2), DistanceBand.near);
    expect(DistanceBandX.forKm(10), DistanceBand.region);
    expect(DistanceBandX.forKm(25), DistanceBand.farther);
    expect(DistanceBandX.forKm(null), DistanceBand.unknown);
  });

  test('inserts headers when band changes', () {
    final entries = withDistanceBandHeaders<double>(const [
      0.5,
      1.0,
      5.0,
      12.0,
    ], (km) => km);
    expect(entries.whereType<BandHeader<double>>().map((e) => e.band), [
      DistanceBand.veryNear,
      DistanceBand.near,
      DistanceBand.region,
    ]);
    expect(entries.whereType<BandItem<double>>().length, 4);
  });
}
