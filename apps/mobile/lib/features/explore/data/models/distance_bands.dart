/// Visual distance bands for a globally distance-sorted Explorar list.
enum DistanceBand {
  veryNear, // < 2 km
  near, // 2–10 km
  region, // 10–25 km
  farther, // ≥ 25 km
  unknown, // null distanceKm
}

extension DistanceBandX on DistanceBand {
  String get label => switch (this) {
    DistanceBand.veryNear => 'Muito perto',
    DistanceBand.near => 'Perto',
    DistanceBand.region => 'Na região',
    DistanceBand.farther => 'Mais longe',
    DistanceBand.unknown => 'Sem localização',
  };

  static DistanceBand forKm(double? distanceKm) {
    if (distanceKm == null) return DistanceBand.unknown;
    if (distanceKm < 2) return DistanceBand.veryNear;
    if (distanceKm < 10) return DistanceBand.near;
    if (distanceKm < 25) return DistanceBand.region;
    return DistanceBand.farther;
  }
}

/// One row in a banded list — either a section header or a data item.
sealed class BandedListEntry<T> {
  const BandedListEntry();
}

class BandHeader<T> extends BandedListEntry<T> {
  const BandHeader(this.band);
  final DistanceBand band;
}

class BandItem<T> extends BandedListEntry<T> {
  const BandItem(this.item);
  final T item;
}

/// Insert band headers while iterating a distance-sorted stream.
/// Items with null distance are grouped under [DistanceBand.unknown] at the end
/// only if they appear after known-distance items (caller should sort nulls last).
List<BandedListEntry<T>> withDistanceBandHeaders<T>(
  Iterable<T> items,
  double? Function(T item) distanceKmOf,
) {
  final out = <BandedListEntry<T>>[];
  DistanceBand? current;
  for (final item in items) {
    final band = DistanceBandX.forKm(distanceKmOf(item));
    if (band != current) {
      current = band;
      out.add(BandHeader(band));
    }
    out.add(BandItem(item));
  }
  return out;
}
