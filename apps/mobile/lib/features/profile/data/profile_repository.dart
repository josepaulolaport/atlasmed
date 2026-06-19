import 'models.dart';

/// Abstract repository for profile data.
abstract class ProfileRepository {
  Future<UserProfile> getProfile();
  Future<TerritoryStats> getTerritoryStats();
  Future<List<QuickSummaryItem>> getQuickSummary();
  Future<List<PreferenceItem>> getPreferences();
  Future<List<RecentActivity>> getRecentActivity();
  Future<List<SupportItem>> getSupportItems();
  Future<void> logout();
}
