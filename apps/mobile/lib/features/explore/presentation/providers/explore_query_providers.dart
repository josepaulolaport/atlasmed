import 'package:atlasmed_mobile_app/core/user/vertical_scope_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_bucket.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_recurrence.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/clinic_providers.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/doctor_list_providers.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/explore_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

const explorePageSize = 20;

final clinicsQueryProvider = Provider<AsyncValue<ClinicsQuery>>((ref) {
  final state = ref.watch(exploreProvider);
  return ref
      .watch(effectiveFacilityVerticalIdProvider)
      .whenData(
        (verticalId) => buildClinicsQuery(state, verticalId: verticalId),
      );
});

final doctorsQueryProvider = Provider<DoctorsQuery>((ref) {
  return buildDoctorsQuery(ref.watch(exploreProvider));
});

ClinicsQuery buildClinicsQuery(
  ExploreState state, {
  int? verticalId,
}) {
  final sort = _facilitySort(state.sort, hasOrigin: state.origin != null);
  final purchaseBuckets = (state.filters['purchaseBucket'] ?? const [])
      .where(PurchaseBucketFilter.values.contains)
      .toList(growable: false);
  final legacyFunnelStages = state.filters['purchaseFunnelStage'] ?? const [];
  final funnelStages = purchaseBuckets.length > 1
      ? purchaseBuckets.expand(PurchaseBucketFilter.funnelApiValues)
      : legacyFunnelStages;

  return ClinicsQuery(
    page: 1,
    limit: explorePageSize,
    searchQuery: _nonEmpty(state.searchQuery),
    latitude: state.origin?.latitude,
    longitude: state.origin?.longitude,
    radiusKm: state.radiusKm,
    commercialStatus: _first(state.filters['status']),
    purchaseBucket: purchaseBuckets.length == 1 ? purchaseBuckets.first : null,
    productIds: _commaJoin(state.filters['products']),
    clinicalFocusIds: _commaJoin(state.filters['clinicalFocusIds']),
    purchaseFunnelStages: funnelStages
        .map(purchaseFunnelStageFromApi)
        .whereType<PurchaseFunnelStage>()
        .toList(growable: false),
    purchaseProfile: purchaseProfileFromApi(
      _first(state.filters['purchaseProfile']),
    ),
    purchaseIntervalMinDays: _intFilter(
      state.filters,
      'purchaseIntervalMinDays',
    ),
    purchaseIntervalMaxDays: _intFilter(
      state.filters,
      'purchaseIntervalMaxDays',
    ),
    sort: sort.sort,
    order: sort.order,
    verticalId: verticalId,
  );
}

DoctorsQuery buildDoctorsQuery(ExploreState state) {
  final sort = _doctorSort(state.sort);
  return DoctorsQuery(
    page: 1,
    limit: explorePageSize,
    searchQuery: _nonEmpty(state.searchQuery),
    latitude: state.origin?.latitude,
    longitude: state.origin?.longitude,
    specialty: _commaJoin(state.filters['specialties']),
    sort: sort.sort,
    order: sort.order,
  );
}

String? _nonEmpty(String value) {
  final trimmed = value.trim();
  return trimmed.isEmpty ? null : trimmed;
}

String? _first(List<String>? values) {
  if (values == null || values.isEmpty) return null;
  return values.first;
}

String? _commaJoin(List<String>? values) {
  if (values == null || values.isEmpty) return null;
  return values.join(',');
}

int? _intFilter(Map<String, List<String>> filters, String key) {
  return int.tryParse(_first(filters[key]) ?? '');
}

({FacilitySort? sort, SortOrder? order}) _facilitySort(
  String value, {
  required bool hasOrigin,
}) => switch (value) {
  'distance' => (
    sort: hasOrigin ? FacilitySort.distance : null,
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

({FacilitySort? sort, SortOrder? order}) _doctorSort(String value) =>
    switch (value) {
      'name-asc' => (sort: FacilitySort.name, order: SortOrder.asc),
      'name-desc' => (sort: FacilitySort.name, order: SortOrder.desc),
      _ => (sort: null, order: null),
    };
