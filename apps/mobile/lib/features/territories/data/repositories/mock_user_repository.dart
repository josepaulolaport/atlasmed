import 'package:atlasmed_mobile_app/features/territories/data/mock/mock_users_data.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/app_user.dart';
import 'package:atlasmed_mobile_app/features/territories/data/repositories/user_repository.dart';

/// In-memory [UserRepository] backed by the static mock dataset. Simulates
/// network latency, same as [MockTerritoryRepository].
class MockUserRepository implements UserRepository {
  final List<AppUser> _users = List<AppUser>.of(mockUsers);

  @override
  Future<AppUser?> getUserById(String id) async {
    await Future.delayed(const Duration(milliseconds: 80));
    for (final user in _users) {
      if (user.id == id) return user;
    }
    return null;
  }

  @override
  Future<List<AppUser>> searchUsers({
    required UserRole role,
    String query = '',
    String? verticalId,
  }) async {
    await Future.delayed(const Duration(milliseconds: 200));
    final needle = query.trim().toLowerCase();
    return _users
        .where(
          (user) =>
              user.role == role &&
              (verticalId == null || user.verticalId == verticalId) &&
              (needle.isEmpty || user.name.toLowerCase().contains(needle)),
        )
        .toList();
  }
}
