import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/profile/data/models/user_profile.dart';
import 'package:atlasmed_mobile_app/features/profile/data/models/territory.dart';
import 'package:atlasmed_mobile_app/features/profile/data/models/activity.dart';
import 'package:atlasmed_mobile_app/features/profile/data/models/preferences.dart';
import 'package:atlasmed_mobile_app/features/profile/data/models/support.dart';
import 'package:atlasmed_mobile_app/core/user/models/user.dart';
import 'package:atlasmed_mobile_app/features/profile/data/mock_profile_repository.dart';
import 'package:atlasmed_mobile_app/features/profile/data/profile_repository.dart';

import 'package:atlasmed_mobile_app/core/session/providers/session_provider.dart';

// ── Repository provider ─────────────────────────────────────
final profileRepositoryProvider = Provider<ProfileRepository>((ref) {
  return MockProfileRepository();
});

// ── Individual data providers ───────────────────────────────
final profileProvider = FutureProvider<UserProfile>((ref) {
  final repo = ref.watch(profileRepositoryProvider);
  return repo.getProfile();
});

final currentUserProvider = FutureProvider<User?>((ref) async {
  final userRepository = ref.watch(userProvider);
  return userRepository.currentValueOrResolve();
});

final sessionProfileProvider = FutureProvider<UserProfile?>((ref) async {
  final user = await ref.watch(currentUserProvider.future);
  if (user == null) return null;

  return UserProfile(
    id: user.id,
    displayName: user.displayName,
    initials: _initials(user.displayName),
    role: user.role.name,
    region: 'Sem território definido',
    email: user.email,
    phone: user.phoneNumber,
  );
});

String _initials(String name) {
  final parts = name.trim().split(' ');
  if (parts.isEmpty || parts.first.isEmpty) return '';
  if (parts.length >= 2) {
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }
  return parts.first[0].toUpperCase();
}

final territoryStatsProvider = FutureProvider<TerritoryStats>((ref) {
  final repo = ref.watch(profileRepositoryProvider);
  return repo.getTerritoryStats();
});

final quickSummaryProvider = FutureProvider<List<QuickSummaryItem>>((ref) {
  final repo = ref.watch(profileRepositoryProvider);
  return repo.getQuickSummary();
});

final preferencesProvider = FutureProvider<List<PreferenceItem>>((ref) async {
  final repo = ref.watch(profileRepositoryProvider);
  final preferences = await repo.getPreferences();
  return preferences
      .where((item) => item.label.toLowerCase() != 'idioma')
      .toList(growable: false);
});

final recentActivityProvider = FutureProvider<List<RecentActivity>>((ref) {
  final repo = ref.watch(profileRepositoryProvider);
  return repo.getRecentActivity();
});

final supportItemsProvider = FutureProvider<List<SupportItem>>((ref) {
  final repo = ref.watch(profileRepositoryProvider);
  return repo.getSupportItems();
});
