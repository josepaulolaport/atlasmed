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
/// The ordering the médicos list will actually be in, given a sheet key.
///
/// The two tabs share one `sort` value but not one vocabulary: the doctors
/// endpoint accepts `name` and nothing else — `SORTS = ["name"]` — and rejects
/// anything else outright. Choosing "Mais próximos" on Clínicas and switching
/// to Médicos therefore left the list name-ordered under a chip that read
/// "Distância", with neither option ticked in its own sort sheet.
///
/// Normalising here means the label, the sheet and the request all read the
/// same key, instead of the request quietly dropping one the other two still
/// show.
String effectiveDoctorSortKey(String key) =>
    key == 'name-desc' ? 'name-desc' : 'name-asc';

({FacilitySort? sort, SortOrder? order}) doctorSortForKey(String key) =>
    effectiveDoctorSortKey(key) == 'name-desc'
    ? (sort: FacilitySort.name, order: SortOrder.desc)
    : (sort: FacilitySort.name, order: SortOrder.asc);

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
