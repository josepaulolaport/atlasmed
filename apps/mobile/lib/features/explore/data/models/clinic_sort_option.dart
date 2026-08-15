import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_recurrence.dart';

/// The sort keys `SortSheet(kind: 'clinic')` offers, and what each means to the
/// API.
///
/// One table rather than a `switch` per screen: Explorar, the Desempenho
/// breakdown and anything else that lists clinics must agree on what "Nome Z–A"
/// does, and a second copy is a second chance to map `desc` to `asc`.
///
/// `distance` is here but only usable where the caller has an origin — Explorar
/// hides the option through `SortSheet(hasLocation:)` rather than offering a
/// sort that silently does nothing.
({FacilitySort? sort, SortOrder? order}) clinicSortForKey(
  String? key, {
  bool hasLocation = false,
}) {
  return switch (key) {
    'distance' => (
      sort: hasLocation ? FacilitySort.distance : null,
      order: SortOrder.asc,
    ),
    'name-asc' => (sort: FacilitySort.name, order: SortOrder.asc),
    'name-desc' => (sort: FacilitySort.name, order: SortOrder.desc),
    'purchase-funnel-asc' => (
      sort: FacilitySort.purchaseFunnelStage,
      order: SortOrder.asc,
    ),
    'purchase-funnel-desc' => (
      sort: FacilitySort.purchaseFunnelStage,
      order: SortOrder.desc,
    ),
    'purchase-interval-asc' => (
      sort: FacilitySort.purchaseIntervalDays,
      order: SortOrder.asc,
    ),
    'purchase-interval-desc' => (
      sort: FacilitySort.purchaseIntervalDays,
      order: SortOrder.desc,
    ),
    'last-purchase-asc' => (
      sort: FacilitySort.lastPurchaseDate,
      order: SortOrder.asc,
    ),
    'last-purchase-desc' => (
      sort: FacilitySort.lastPurchaseDate,
      order: SortOrder.desc,
    ),
    _ => (sort: null, order: null),
  };
}
