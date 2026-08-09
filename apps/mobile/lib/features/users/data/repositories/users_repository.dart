import 'package:atlasmed_mobile_app/core/user/models/user.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_status.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/assignment_option.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/invite_vertical_assignment.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/user_assignments.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/users_filter.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/users_page.dart';

/// Port for the admin user-management data source.
///
/// Method signatures mirror the real `/api/v1/access` endpoints (see
/// `apps/api/src/modules/access`) so a future HTTP-backed implementation is
/// a drop-in replacement for [MockUsersRepository].
abstract interface class UsersRepository {
  /// `GET /access/users?page=&limit=&search=&role=&status=&sortBy=&sortDir=`
  Future<UsersPage> getUsers({
    required int page,
    int limit = 20,
    String? search,
    UserRoleName? role,
    UserStatus? status,
    UsersSortBy sortBy = UsersSortBy.createdAt,
    UsersSortDir sortDir = UsersSortDir.desc,
  });

  /// `GET /access/users/:id`
  Future<User?> getUserById(int id);

  /// `PATCH /access/users/:id` — profile fields (name, email, phone, …).
  Future<User> updateUserProfile({
    required int userId,
    required String firstName,
    required String lastName,
    required String email,
    required String phoneNumber,
    required String username,
    DateTime? birthDate,
  });

  /// `GET /access/users/:id/assignments` (admin-scoped — not yet mounted
  /// on the real API today, only the self-service `GET /user/assignments`
  /// is; the mock behaves as if the admin route already existed).
  Future<UserAssignments> getUserAssignments(int userId);

  /// Replace the full per-sector assignment set (invite-shaped payload).
  Future<void> replaceVerticalAssignments(
    int userId,
    List<InviteVerticalAssignment> verticalAssignments,
  );

  /// `POST /access/users/:id/activate`
  Future<void> activateUser(int userId);

  /// `POST /access/users/:id/deactivate`
  Future<void> deactivateUser(int userId);

  /// `POST /access/users/:id/suspend`
  Future<void> suspendUser(int userId, {String? reason});

  /// `POST /access/users/:id/unsuspend`
  Future<void> unsuspendUser(int userId);

  /// `PATCH /access/users/:id/role`
  Future<void> changeUserRole(int userId, int roleId);

  /// `POST /access/users/:id/territories`
  Future<void> assignTerritory(int userId, int territoryId);

  /// `DELETE /access/users/:id/territories/:territoryId`
  Future<void> revokeTerritory(int userId, int territoryId);

  /// `POST /access/users/:id/verticals`
  Future<void> assignVertical(int userId, int verticalId);

  /// `DELETE /access/users/:id/verticals/:verticalId`
  Future<void> revokeVertical(int userId, int verticalId);

  /// `GET /access/roles`
  Future<List<UserRole>> getRoles();

  /// `GET /access/business-verticals`
  Future<List<VerticalOption>> getVerticals();

  /// `GET /access/users?role=MANAGER&verticalId=` — managers for a sector.
  Future<List<ManagerOption>> getManagerOptions({int? verticalId});

  /// `GET /territories?type=manager_zone&verticalId=` — manager zones.
  Future<List<TerritoryOption>> getTerritoryOptions({int? verticalId});

  /// `GET /access/territories/:id/assignments` — first assignee display name.
  Future<String?> getTerritoryAssigneeName(int territoryId);

  /// `GET /territories?type=patch&managerTerritoryId=&verticalId=` — patches
  /// under a manager zone (includes [TerritoryOption.isOccupied]).
  Future<List<TerritoryOption>> getPatchesForZone({
    required int managerZoneId,
    int? verticalId,
  });
}
