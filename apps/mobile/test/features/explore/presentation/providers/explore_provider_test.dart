import 'package:atlasmed_mobile_app/features/explore/presentation/providers/explore_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test(
    'updates the visible query immediately and debounces repository search',
    () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final notifier = container.read(exploreProvider.notifier);

      notifier.setQuery('central');

      expect(notifier.state.query, 'central');
      expect(notifier.state.searchQuery, '');

      await Future<void>.delayed(const Duration(milliseconds: 400));

      expect(notifier.state.searchQuery, 'central');
    },
  );

  test('tab, filters, and sort update query intent without remote lists', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final notifier = container.read(exploreProvider.notifier);

    notifier.setTab('doctor');
    notifier.applyFilters(
      filters: const {
        'specialties': ['Cardiologia'],
      },
      clearRadius: true,
    );
    notifier.setSort('name-desc');

    expect(notifier.state.activeTab, 'doctor');
    expect(notifier.state.filters['specialties'], ['Cardiologia']);
    expect(notifier.state.radiusKm, isNull);
    expect(notifier.state.sort, 'name-desc');
  });

  test('dashboard purchase bucket keeps the canonical bucket filter', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final notifier = container.read(exploreProvider.notifier);

    notifier.applyPurchaseBucket('inactive');

    expect(notifier.state.activeTab, 'clinic');
    expect(notifier.state.filters['status'], isEmpty);
    expect(notifier.state.filters['purchaseFunnelStage'], isEmpty);
    expect(notifier.state.filters['purchaseBucket'], ['inactive']);
  });
}
