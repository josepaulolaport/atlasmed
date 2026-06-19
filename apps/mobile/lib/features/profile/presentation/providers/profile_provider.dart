import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/models.dart';
import '../../data/mock_profile_repository.dart';
import '../../data/profile_repository.dart';

// ── Repository provider ─────────────────────────────────────
final profileRepositoryProvider = Provider<ProfileRepository>((ref) {
  return MockProfileRepository();
});

// ── Individual data providers ───────────────────────────────
final profileProvider = FutureProvider<UserProfile>((ref) {
  final repo = ref.watch(profileRepositoryProvider);
  return repo.getProfile();
});

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
