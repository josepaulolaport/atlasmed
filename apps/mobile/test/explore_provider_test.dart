import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/explore/data/mock_explore_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/explore_provider.dart';

void main() {
  test('ExploreNotifier loads clinics on open and supports search', () async {
    final container = ProviderContainer(
      overrides: [
        exploreRepositoryProvider.overrideWithValue(MockExploreRepository()),
      ],
    );
    addTearDown(container.dispose);

    final notifier = container.read(exploreProvider.notifier);

    await notifier.loadData();
    expect(container.read(exploreProvider).clinics, isNotEmpty);
    expect(container.read(exploreProvider).doctors, isEmpty);

    notifier.setQuery('Ana');
    await Future<void>.delayed(const Duration(milliseconds: 450));
    final state = container.read(exploreProvider);
    expect(state.clinics, isNotEmpty);
    expect(state.doctors, isEmpty);

    await notifier.setTab('doctor');
    expect(container.read(exploreProvider).doctors, isNotEmpty);
  });
}
