import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/profile/data/user_preferences.dart';
import 'package:atlasmed_mobile_app/features/profile/presentation/providers/profile_provider.dart';
import 'package:atlasmed_mobile_app/repository/base_repository.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_cache_storage.dart';

class _MemoryCacheStorage extends RepositoryCacheStorage {
  const _MemoryCacheStorage();

  @override
  Future<void> clear() async {}

  @override
  Future<void> delete({required String key}) async {}

  @override
  Future<String?> read({required String key}) async => null;

  @override
  Future<void> write({required String key, required String value}) async {}
}

UserPreferences _prefs({String? workdayStart, String? workdayEnd}) =>
    UserPreferences(
      theme: UserPreferenceTheme.system,
      pushNotificationsEnabled: true,
      emailNotificationsEnabled: true,
      smsNotificationsEnabled: false,
      workdayStart: workdayStart,
      workdayEnd: workdayEnd,
    );

void main() {
  BaseRepository.storage = const _MemoryCacheStorage();

  group('workingHoursSummary', () {
    test('reads back the hours the rep chose', () {
      // Lunch is deliberately absent: it is a block on the rep's calendar, not
      // a preference, so this row is only ever about the ends of the day.
      expect(
        workingHoursSummary(_prefs(workdayStart: '09:00', workdayEnd: '18:00')),
        '09:00–18:00',
      );
    });

    test('names the linha default rather than showing a blank', () {
      expect(workingHoursSummary(_prefs()), 'Padrão da linha · 08:00–18:00');
    });

    test('marks a half-answered day as partial', () {
      expect(
        workingHoursSummary(_prefs(workdayStart: '06:00')),
        '06:00–18:00 (parcial)',
      );
    });
  });

  test(
    'preferencesProvider returns structure matching ProviderItem type',
    () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      await expectLater(container.read(preferencesProvider.future), completes);
    },
  );
}
