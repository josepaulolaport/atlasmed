import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/profile/data/models.dart';
import 'package:atlasmed_mobile_app/features/profile/data/mock_profile_repository.dart';
import 'package:atlasmed_mobile_app/features/profile/data/profile_repository.dart';

import 'package:atlasmed_mobile_app/core/providers/session_provider.dart';

// ── Repository provider ─────────────────────────────────────
final profileRepositoryProvider = Provider<ProfileRepository>((ref) {
  return MockProfileRepository();
});

// ── Individual data providers ───────────────────────────────
final profileProvider = FutureProvider<UserProfile>((ref) {
  final repo = ref.watch(profileRepositoryProvider);
  return repo.getProfile();
});

final sessionProfileProvider = Provider<UserProfile?>((ref) {
  final user = ref.watch(userProvider).valueOrNull;
  if (user == null) return null;

  return UserProfile(
    id: user.id,
    displayName: user.displayName,
    initials: _initials(user.displayName),
    role: user.role.name,
    region: 'Sem território definido',
    email: user.email,
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

final preferencesProvider = FutureProvider<List<PreferenceItem>>((ref) {
  final repo = ref.watch(profileRepositoryProvider);
  return repo.getPreferences();
});

final recentActivityProvider = FutureProvider<List<RecentActivity>>((ref) {
  final repo = ref.watch(profileRepositoryProvider);
  return repo.getRecentActivity();
});

final supportItemsProvider = FutureProvider<List<SupportItem>>((ref) {
  final repo = ref.watch(profileRepositoryProvider);
  return repo.getSupportItems();
});
