import 'dart:async';

import 'package:atlasmed_mobile_app/features/explore/data/api_types/clinic_api_type.dart'
    as api;
import 'package:atlasmed_mobile_app/features/explore/data/api_types/query_builder.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_recurrence.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/explore_provider.dart';
import 'package:atlasmed_mobile_app/features/location/data/location_service.dart';
import 'package:flutter_test/flutter_test.dart';

class _LocationServiceStub implements LocationService {
  @override
  Future<LocationResult> requestCurrentLocation() async =>
      const LocationUnavailable(LocationFailure.unavailable);
}

api.PaginatedClinics page(
  String id,
  int page, {
  int totalPages = 1,
  int total = 1,
  int itemCount = 1,
}) => api.PaginatedClinics(
  items: [
    for (var index = 0; index < itemCount; index++)
      api.Clinic(id: '$id-$index', name: '$id-$index', professionalCount: 0),
  ],
  pagination: Pagination(
    page: page,
    limit: 20,
    total: total,
    totalPages: totalPages,
  ),
);

void main() {
  test(
    'filters reset to page one and loadMore retains active server params',
    () async {
      final requests = <ExploreClinicRequest>[];
      final notifier = ExploreNotifier(
        _LocationServiceStub(),
        clinicLoader: (request) async {
          requests.add(request);
          return page('facility-${request.page}', request.page, totalPages: 2);
        },
        doctorLoader: (_) async => null,
        searchDebounce: Duration.zero,
      );

      await notifier.loadData();
      notifier.setFilters({
        'purchaseFunnelStage': ['CHURN'],
        'purchaseProfile': ['MONTHLY'],
      });
      await Future<void>.delayed(Duration.zero);
      await notifier.loadMore();

      expect(requests[1].page, 1);
      expect(requests[1].purchaseFunnelStages, [PurchaseFunnelStage.churn]);
      expect(requests[2].page, 2);
      expect(requests[2].purchaseProfile, PurchaseProfile.monthly);
    },
  );

  test(
    'uses name ascending until valid relevance or distance is selected',
    () async {
      final requests = <ExploreClinicRequest>[];
      final notifier = ExploreNotifier(
        _LocationServiceStub(),
        clinicLoader: (request) async {
          requests.add(request);
          return page('facility', 1);
        },
        doctorLoader: (_) async => null,
        searchDebounce: Duration.zero,
      );

      await notifier.loadData();
      expect(requests.last.sort, FacilitySort.name);
      expect(requests.last.order, SortOrder.asc);

      notifier.setSort('relevance');
      await Future<void>.delayed(Duration.zero);
      expect(requests.last.sort, FacilitySort.name);
      expect(notifier.state.sort, 'name-asc');

      notifier.setQuery('cardio');
      await Future<void>.delayed(Duration.zero);
      notifier.setSort('relevance');
      await Future<void>.delayed(Duration.zero);
      expect(requests.last.sort, FacilitySort.relevance);
      expect(requests.last.searchQuery, 'cardio');

      notifier.setQuery('');
      await Future<void>.delayed(Duration.zero);
      expect(requests.last.sort, FacilitySort.name);
      expect(requests.last.searchQuery, isNull);
    },
  );

  test('keeps all loaded server rows and records the server total', () async {
    final notifier = ExploreNotifier(
      _LocationServiceStub(),
      clinicLoader: (request) async => request.page == 1
          ? page('first', 1, totalPages: 2, total: 25, itemCount: 20)
          : page('second', 2, totalPages: 2, total: 25, itemCount: 5),
      doctorLoader: (_) async => null,
    );

    await notifier.loadData();
    expect(notifier.state.clinics, hasLength(20));
    expect(notifier.state.clinicTotal, 25);
    expect(notifier.state.clinicHasMore, isTrue);

    await notifier.loadMore();
    expect(notifier.state.clinics, hasLength(25));
    expect(notifier.state.clinicHasMore, isFalse);
    expect(notifier.state.loadingMore, isFalse);
  });

  test(
    'one full server page is not truncated and has no more-page spinner',
    () async {
      final notifier = ExploreNotifier(
        _LocationServiceStub(),
        clinicLoader: (_) async =>
            page('only', 1, totalPages: 1, total: 20, itemCount: 20),
        doctorLoader: (_) async => null,
      );

      await notifier.loadData();

      expect(notifier.state.clinics, hasLength(20));
      expect(notifier.state.clinicTotal, 20);
      expect(notifier.state.clinicHasMore, isFalse);
      expect(notifier.state.loadingMore, isFalse);
    },
  );

  test(
    'refreshAfterClinicUpdate refreshes page one with current query',
    () async {
      final requests = <ExploreClinicRequest>[];
      final notifier = ExploreNotifier(
        _LocationServiceStub(),
        clinicLoader: (request) async {
          requests.add(request);
          return page('server', 1);
        },
        doctorLoader: (_) async => null,
        searchDebounce: Duration.zero,
      );

      notifier.setQuery('central');
      await Future<void>.delayed(Duration.zero);
      await notifier.refreshAfterClinicUpdate(
        const api.Clinic(
          id: 'facility-1',
          name: 'Atualizada',
          professionalCount: 0,
        ),
      );

      expect(requests.last.page, 1);
      expect(requests.last.searchQuery, 'central');
    },
  );

  test('debounces search and ignores a stale response', () async {
    final first = Completer<api.PaginatedClinics?>();
    final second = Completer<api.PaginatedClinics?>();
    final requests = <ExploreClinicRequest>[];
    final notifier = ExploreNotifier(
      _LocationServiceStub(),
      clinicLoader: (request) {
        requests.add(request);
        return request.searchQuery == 'nova' ? second.future : first.future;
      },
      doctorLoader: (_) async => null,
      searchDebounce: const Duration(milliseconds: 10),
    );

    notifier.setQuery('antiga');
    await Future<void>.delayed(const Duration(milliseconds: 12));
    notifier.setQuery('nova');
    await Future<void>.delayed(const Duration(milliseconds: 12));
    second.complete(page('nova', 1));
    await Future<void>.delayed(Duration.zero);
    first.complete(page('antiga', 1));
    await Future<void>.delayed(Duration.zero);

    expect(requests.map((r) => r.searchQuery), ['antiga', 'nova']);
    expect(notifier.state.clinics.single.id, 'nova-0');
  });

  test('preserves rows on error and retry fetches again', () async {
    var attempts = 0;
    final notifier = ExploreNotifier(
      _LocationServiceStub(),
      clinicLoader: (_) async {
        attempts++;
        if (attempts == 1) return page('existing', 1);
        if (attempts == 2) throw Exception('offline');
        return page('recovered', 1);
      },
      doctorLoader: (_) async => null,
      searchDebounce: Duration.zero,
    );

    await notifier.loadData();
    await notifier.refresh();
    expect(notifier.state.clinics.single.id, 'existing-0');
    expect(notifier.state.errorMessage, isNotNull);
    await notifier.retry();
    expect(notifier.state.clinics.single.id, 'recovered-0');
    expect(notifier.state.errorMessage, isNull);
  });
}
