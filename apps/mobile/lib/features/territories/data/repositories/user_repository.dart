import 'package:atlasmed_mobile_app/features/territories/data/models/app_user.dart';

/// Port for the (rep/manager) users data source — deliberately small,
/// this is only what the assignment/search UI needs, not a general user
/// management API.
abstract interface class UserRepository {
  Future<AppUser?> getUserById(String id);

  /// Users matching [role] (and, when given, [verticalId]) whose name
  /// contains [query] (case-insensitive). An empty [query] returns every
  /// matching user — the picker's initial, unfiltered list.
  Future<List<AppUser>> searchUsers({
    required UserRole role,
    String query = '',
    String? verticalId,
  });
}
