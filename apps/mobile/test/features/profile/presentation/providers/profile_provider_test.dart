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

UserPreferences _prefs({
  String? workdayStart,
  String? workdayEnd,
  int? lunchMinutes,
}) => UserPreferences(
  theme: UserPreferenceTheme.system,
  pushNotificationsEnabled: true,
  emailNotificationsEnabled: true,
  smsNotificationsEnabled: false,
  workdayStart: workdayStart,
  workdayEnd: workdayEnd,
  lunchMinutes: lunchMinutes,
);

void main() {
  BaseRepository.storage = const _MemoryCacheStorage();

  group('workingHoursSummary', () {
    test('says the lunch break is reserved, and for how long', () {
      // The engine blocks `lunchMinutes` out of the day, so whether it is
      // reserved at all belongs on the row the rep reads.
      expect(
        workingHoursSummary(
          _prefs(workdayStart: '09:00', workdayEnd: '18:00', lunchMinutes: 60),
        ),
        '09:00–18:00 · almoço 1h',
      );
    });

    test('stays silent when no lunch is reserved', () {
      // Zero was every rep's stored value, because the sheet asked when lunch
      // started and never how long it ran.
      expect(
        workingHoursSummary(
          _prefs(workdayStart: '09:00', workdayEnd: '18:00', lunchMinutes: 0),
        ),
        '09:00–18:00',
      );
    });

    test('names the linha default rather than showing a blank', () {
      expect(
        workingHoursSummary(_prefs()),
        'Padrão da linha · 08:00–18:00',
      );
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
