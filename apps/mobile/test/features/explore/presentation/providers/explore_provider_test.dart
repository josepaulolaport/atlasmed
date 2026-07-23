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

api.PaginatedClinics page(String id, int page, {int totalPages = 1}) =>
    api.PaginatedClinics(
      items: [api.Clinic(id: id, name: id, professionalCount: 0)],
      pagination: Pagination(
        page: page,
        limit: 20,
        total: totalPages,
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
    expect(notifier.state.clinics.single.id, 'nova');
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
    expect(notifier.state.clinics.single.id, 'existing');
    expect(notifier.state.errorMessage, isNotNull);
    await notifier.retry();
    expect(notifier.state.clinics.single.id, 'recovered');
    expect(notifier.state.errorMessage, isNull);
  });
}
