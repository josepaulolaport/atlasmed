import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/profile/data/models/user_profile.dart';
import 'package:atlasmed_mobile_app/features/profile/data/models/territory.dart';
import 'package:atlasmed_mobile_app/features/profile/data/models/activity.dart';
import 'package:atlasmed_mobile_app/features/profile/data/models/preferences.dart';
import 'package:atlasmed_mobile_app/features/profile/data/models/support.dart';
import 'package:atlasmed_mobile_app/features/profile/data/profile_repository.dart';
import 'package:atlasmed_mobile_app/features/profile/presentation/providers/profile_provider.dart';

void main() {
  test(
    'preferencesProvider omits language preference from rendered preferences',
    () async {
      final container = ProviderContainer(
        overrides: [
          profileRepositoryProvider.overrideWithValue(_ProfileRepositoryStub()),
        ],
      );
      addTearDown(container.dispose);

      final preferences = await container.read(preferencesProvider.future);

      expect(preferences.map((item) => item.label), isNot(contains('Idioma')));
    },
  );
}

class _ProfileRepositoryStub implements ProfileRepository {
  @override
  Future<UserProfile> getProfile() => throw UnimplementedError();

  @override
  Future<TerritoryStats> getTerritoryStats() => throw UnimplementedError();

  @override
  Future<List<QuickSummaryItem>> getQuickSummary() =>
      throw UnimplementedError();

  @override
  Future<List<PreferenceItem>> getPreferences() async => const [
    PreferenceItem(label: 'Alertas de follow-up', sub: 'Lembretes'),
    PreferenceItem(label: 'Idioma', sub: 'Português (Brasil)'),
  ];

  @override
  Future<List<RecentActivity>> getRecentActivity() =>
      throw UnimplementedError();

  @override
  Future<List<SupportItem>> getSupportItems() => throw UnimplementedError();

  @override
  Future<void> logout() => throw UnimplementedError();
}
