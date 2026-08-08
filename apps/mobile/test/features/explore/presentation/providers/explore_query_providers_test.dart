import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_recurrence.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/clinic_providers.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/doctor_list_providers.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/explore_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/explore_query_providers.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/explore_paged_results.dart';
import 'package:atlasmed_mobile_app/features/location/data/location_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('clinic query copyWith changes only the page', () {
    const query = ClinicsQuery(
      page: 1,
      limit: 25,
      searchQuery: 'central',
      latitude: -23.5,
      longitude: -46.6,
      radiusKm: 10,
      commercialStatus: 'ACTIVE',
      purchaseBucket: 'active',
      productIds: 'product-1,product-2',
      clinicalFocusIds: '1',
      purchaseFunnelStages: [PurchaseFunnelStage.purchaseWindow],
      purchaseProfile: PurchaseProfile.monthly,
      purchaseIntervalMinDays: 10,
      purchaseIntervalMaxDays: 40,
      sort: FacilitySort.lastPurchaseDate,
      order: SortOrder.desc,
      verticalId: 1,
    );

    final pageTwo = query.copyWith(page: 2);

    expect(pageTwo.page, 2);
    expect(pageTwo.limit, query.limit);
    expect(pageTwo.searchQuery, query.searchQuery);
    expect(pageTwo.latitude, query.latitude);
    expect(pageTwo.longitude, query.longitude);
    expect(pageTwo.radiusKm, query.radiusKm);
    expect(pageTwo.commercialStatus, query.commercialStatus);
    expect(pageTwo.purchaseBucket, query.purchaseBucket);
    expect(pageTwo.productIds, query.productIds);
    expect(pageTwo.clinicalFocusIds, query.clinicalFocusIds);
    expect(pageTwo.purchaseFunnelStages, query.purchaseFunnelStages);
    expect(pageTwo.purchaseProfile, query.purchaseProfile);
    expect(pageTwo.purchaseIntervalMinDays, query.purchaseIntervalMinDays);
    expect(pageTwo.purchaseIntervalMaxDays, query.purchaseIntervalMaxDays);
    expect(pageTwo.sort, query.sort);
    expect(pageTwo.order, query.order);
    expect(pageTwo.verticalId, query.verticalId);
  });

  test('doctor query copyWith changes only the page', () {
    const query = DoctorsQuery(
      page: 1,
      limit: 25,
      searchQuery: 'ana',
      facilityId: 1,
      latitude: -23.5,
      longitude: -46.6,
      radiusKm: 15,
      specialty: 'Cardiologia',
      sort: FacilitySort.name,
      order: SortOrder.asc,
    );

    final pageThree = query.copyWith(page: 3);

    expect(pageThree.page, 3);
    expect(pageThree.limit, query.limit);
    expect(pageThree.searchQuery, query.searchQuery);
    expect(pageThree.facilityId, query.facilityId);
    expect(pageThree.latitude, query.latitude);
    expect(pageThree.longitude, query.longitude);
    expect(pageThree.radiusKm, query.radiusKm);
    expect(pageThree.specialty, query.specialty);
    expect(pageThree.sort, query.sort);
    expect(pageThree.order, query.order);
  });

  test('global item index maps to a one-based page and page offset', () {
    expect(
      ExplorePageIndex.fromGlobalIndex(0, pageSize: 20),
      const ExplorePageIndex(page: 1, offset: 0),
    );
    expect(
      ExplorePageIndex.fromGlobalIndex(19, pageSize: 20),
      const ExplorePageIndex(page: 1, offset: 19),
    );
    expect(
      ExplorePageIndex.fromGlobalIndex(20, pageSize: 20),
      const ExplorePageIndex(page: 2, offset: 0),
    );
    expect(
      ExplorePageIndex.fromGlobalIndex(47, pageSize: 20),
      const ExplorePageIndex(page: 3, offset: 7),
    );
  });

  test('clinic query builder maps explore filters and server sort', () {
    const state = ExploreState(
      searchQuery: 'central',
      filters: {
        'status': ['ACTIVE'],
        'purchaseBucket': ['active'],
        'products': ['product-1', 'product-2'],
        'clinicalFocusIds': ['1'],
        'purchaseFunnelStage': ['PURCHASE_WINDOW'],
        'purchaseProfile': ['MONTHLY'],
        'purchaseIntervalMinDays': ['10'],
        'purchaseIntervalMaxDays': ['40'],
      },
      sort: 'last-purchase-desc',
      origin: DeviceLocation(latitude: -23.5, longitude: -46.6),
      radiusKm: 25,
    );

    final query = buildClinicsQuery(state, verticalId: 1);

    expect(query.page, 1);
    expect(query.searchQuery, 'central');
    expect(query.latitude, -23.5);
    expect(query.longitude, -46.6);
    expect(query.radiusKm, 25);
    expect(query.commercialStatus, 'ACTIVE');
    expect(query.purchaseBucket, 'active');
    expect(query.productIds, 'product-1,product-2');
    expect(query.clinicalFocusIds, '1');
    expect(query.purchaseFunnelStages, [PurchaseFunnelStage.purchaseWindow]);
    expect(query.purchaseProfile, PurchaseProfile.monthly);
    expect(query.purchaseIntervalMinDays, 10);
    expect(query.purchaseIntervalMaxDays, 40);
    expect(query.sort, FacilitySort.lastPurchaseDate);
    expect(query.order, SortOrder.desc);
    expect(query.verticalId, 1);
  });

  test('multiple purchase buckets expand into funnel stages', () {
    const state = ExploreState(
      filters: {
        'purchaseBucket': ['active', 'inactive'],
      },
    );

    final query = buildClinicsQuery(state, verticalId: null);

    expect(query.purchaseBucket, isNull);
    expect(query.purchaseFunnelStages, [
      PurchaseFunnelStage.purchaseWindow,
      PurchaseFunnelStage.outsideWindow,
      PurchaseFunnelStage.churn,
    ]);
  });

  test('doctor query builder maps specialty, radius, and name sort', () {
    const state = ExploreState(
      searchQuery: 'ana',
      filters: {
        'specialties': ['Cardiologia', 'Pediatria'],
      },
      sort: 'name-asc',
      origin: DeviceLocation(latitude: -23.5, longitude: -46.6),
      radiusKm: 15,
    );

    final query = buildDoctorsQuery(state);

    expect(query.page, 1);
    expect(query.searchQuery, 'ana');
    expect(query.latitude, -23.5);
    expect(query.longitude, -46.6);
    expect(query.radiusKm, 15);
    expect(query.specialty, 'Cardiologia,Pediatria');
    expect(query.sort, FacilitySort.name);
    expect(query.order, SortOrder.asc);
  });
}
