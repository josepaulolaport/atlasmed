import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/core/session/providers/session_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_recurrence.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/clinics_repository.dart';

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
  final List<PurchaseFunnelStage> purchaseFunnelStages;
  final PurchaseProfile? purchaseProfile;
  final int? purchaseIntervalMinDays;
  final int? purchaseIntervalMaxDays;
  final FacilitySort? sort;
  final SortOrder? order;
  final String? verticalId;

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

final clinicsRepositoryProvider = Provider.autoDispose
    .family<ClinicsRepository, ClinicsQuery>((ref, query) {
      ref.watch(sessionProvider);
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
