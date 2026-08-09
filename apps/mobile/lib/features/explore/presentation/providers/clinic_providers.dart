import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api/facility_api.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_recurrence.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/clinics_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/explore_page_cache.dart';

class ClinicsQuery {
  const ClinicsQuery({
    this.page = 1,
    this.limit = 20,
    this.searchQuery,
    this.latitude,
    this.longitude,
    this.radiusKm,
    this.commercialStatus,
    this.purchaseBucket,
    this.productIds,
    this.clinicalFocusIds,
    this.purchaseFunnelStages = const [],
    this.purchaseProfile,
    this.purchaseIntervalMinDays,
    this.purchaseIntervalMaxDays,
    this.sort,
    this.order,
    this.verticalId,
  });

  final int page;
  final int limit;
  final String? searchQuery;
  final double? latitude;
  final double? longitude;
  final double? radiusKm;
  final String? commercialStatus;
  final String? purchaseBucket;
  final String? productIds;
  final String? clinicalFocusIds;
  final List<PurchaseFunnelStage> purchaseFunnelStages;
  final PurchaseProfile? purchaseProfile;
  final int? purchaseIntervalMinDays;
  final int? purchaseIntervalMaxDays;
  final FacilitySort? sort;
  final SortOrder? order;
  final int? verticalId;

  ClinicsQuery copyWith({int? page}) {
    return ClinicsQuery(
      page: page ?? this.page,
      limit: limit,
      searchQuery: searchQuery,
      latitude: latitude,
      longitude: longitude,
      radiusKm: radiusKm,
      commercialStatus: commercialStatus,
      purchaseBucket: purchaseBucket,
      productIds: productIds,
      clinicalFocusIds: clinicalFocusIds,
      purchaseFunnelStages: purchaseFunnelStages,
      purchaseProfile: purchaseProfile,
      purchaseIntervalMinDays: purchaseIntervalMinDays,
      purchaseIntervalMaxDays: purchaseIntervalMaxDays,
      sort: sort,
      order: order,
      verticalId: verticalId,
    );
  }

  @override
  bool operator ==(Object other) {
    return other is ClinicsQuery &&
        other.page == page &&
        other.limit == limit &&
        other.searchQuery == searchQuery &&
        other.latitude == latitude &&
        other.longitude == longitude &&
        other.radiusKm == radiusKm &&
        other.commercialStatus == commercialStatus &&
        other.purchaseBucket == purchaseBucket &&
        other.productIds == productIds &&
        other.clinicalFocusIds == clinicalFocusIds &&
        _sameStages(other.purchaseFunnelStages, purchaseFunnelStages) &&
        other.purchaseProfile == purchaseProfile &&
        other.purchaseIntervalMinDays == purchaseIntervalMinDays &&
        other.purchaseIntervalMaxDays == purchaseIntervalMaxDays &&
        other.sort == sort &&
        other.order == order &&
        other.verticalId == verticalId;
  }

  @override
  int get hashCode => Object.hash(
    page,
    limit,
    searchQuery,
    latitude,
    longitude,
    radiusKm,
    commercialStatus,
    purchaseBucket,
    productIds,
    clinicalFocusIds,
    Object.hashAll(purchaseFunnelStages),
    purchaseProfile,
    purchaseIntervalMinDays,
    purchaseIntervalMaxDays,
    sort,
    order,
    verticalId,
  );

  static bool _sameStages(
    List<PurchaseFunnelStage> left,
    List<PurchaseFunnelStage> right,
  ) =>
      left.length == right.length &&
      left.asMap().entries.every((entry) => right[entry.key] == entry.value);

  /// Whether this query would return distinct results from [other].
  bool differsFrom(ClinicsQuery other) => this != other;
}

final clinicsPageProvider = StreamProvider.autoDispose
    .family<PaginatedFacilities, ClinicsQuery>((ref, query) async* {
      final sessionTag = await ref.watch(exploreSessionCacheTagProvider.future);
      if (sessionTag == null) return;
      final repository = ref.watch(
        _clinicsPageRepositoryProvider((query: query, sessionTag: sessionTag)),
      );
      keepExplorePageAlive(ref);

      final currentValue = repository.currentValue;
      if (currentValue != null) yield currentValue;

      await for (final repositoryState in repository.stream) {
        final data = repositoryState.map(ready: (state) => state.data);
        if (data != null && !identical(data, currentValue)) yield data;
      }
    });

final clinicsRepositoryProvider = Provider.autoDispose
    .family<ClinicsRepository, ClinicsQuery>((ref, query) {
      final repository = ClinicsRepository(
        page: query.page,
        limit: query.limit,
        searchQuery: query.searchQuery,
        latitude: query.latitude,
        longitude: query.longitude,
        radiusKm: query.radiusKm,
        commercialStatus: query.commercialStatus,
        purchaseBucket: query.purchaseBucket,
        productIds: query.productIds,
        clinicalFocusIds: query.clinicalFocusIds,
        purchaseFunnelStages: query.purchaseFunnelStages,
        purchaseProfile: query.purchaseProfile,
        purchaseIntervalMinDays: query.purchaseIntervalMinDays,
        purchaseIntervalMaxDays: query.purchaseIntervalMaxDays,
        sort: query.sort,
        order: query.order,
        verticalId: query.verticalId,
      );
      ref.onDispose(repository.dispose);
      return repository;
    });

final _clinicsPageRepositoryProvider = Provider.autoDispose
    .family<ClinicsRepository, ({ClinicsQuery query, String sessionTag})>((
      ref,
      request,
    ) {
      final query = request.query;
      final repository = ClinicsRepository(
        cacheTag: request.sessionTag,
        page: query.page,
        limit: query.limit,
        searchQuery: query.searchQuery,
        latitude: query.latitude,
        longitude: query.longitude,
        radiusKm: query.radiusKm,
        commercialStatus: query.commercialStatus,
        purchaseBucket: query.purchaseBucket,
        productIds: query.productIds,
        clinicalFocusIds: query.clinicalFocusIds,
        purchaseFunnelStages: query.purchaseFunnelStages,
        purchaseProfile: query.purchaseProfile,
        purchaseIntervalMinDays: query.purchaseIntervalMinDays,
        purchaseIntervalMaxDays: query.purchaseIntervalMaxDays,
        sort: query.sort,
        order: query.order,
        verticalId: query.verticalId,
      );
      ref.onDispose(repository.dispose);
      return repository;
    });
