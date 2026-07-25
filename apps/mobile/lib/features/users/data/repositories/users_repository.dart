import 'package:atlasmed_mobile_app/core/user/models/user.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_status.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/assignment_option.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/invite_vertical_assignment.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/permission_grant.dart';
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
  Future<User?> getUserById(String id);

  /// `PATCH /access/users/:id` — profile fields (name, email, phone, …).
  Future<User> updateUserProfile({
    required String userId,
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
  Future<UserAssignments> getUserAssignments(String userId);

  /// Replace the full per-sector assignment set (invite-shaped payload).
  Future<void> replaceVerticalAssignments(
    String userId,
    List<InviteVerticalAssignment> verticalAssignments,
  );

  /// `GET /access/users/:id/capabilities` (grants slice only — role is
  /// already on [User.role]).
  Future<List<PermissionGrant>> getUserPermissions(String userId);

  /// `POST /access/users/:id/activate`
  Future<void> activateUser(String userId);

  /// `POST /access/users/:id/deactivate`
  Future<void> deactivateUser(String userId);

  /// `POST /access/users/:id/suspend`
  Future<void> suspendUser(String userId, {String? reason});

  /// `POST /access/users/:id/unsuspend`
  Future<void> unsuspendUser(String userId);

  /// `PATCH /access/users/:id/role`
  Future<void> changeUserRole(String userId, String roleId);

  /// `PATCH /access/users/:id/manager`
  Future<void> assignManager(String userId, String? managerId);

  /// `POST /access/users/:id/territories`
  Future<void> assignTerritory(String userId, String territoryId);

  /// `DELETE /access/users/:id/territories/:territoryId`
  Future<void> revokeTerritory(String userId, String territoryId);

  /// `POST /access/users/:id/verticals`
  Future<void> assignVertical(String userId, String verticalId);

  /// `DELETE /access/users/:id/verticals/:verticalId`
  Future<void> revokeVertical(String userId, String verticalId);

  /// `POST /access/users/:id/permissions`
  Future<void> grantPermission(
    String userId, {
    required String resource,
    required String action,
    String? resourceId,
    DateTime? expiresAt,
  });

  /// `DELETE /access/users/:id/permissions` — body uses resource/action/resourceId.
  Future<void> revokePermission(
    String userId, {
    required String resource,
    required String action,
    String? resourceId,
  });

  /// `GET /access/roles`
  Future<List<UserRole>> getRoles();

  /// `GET /access/business-verticals`
  Future<List<VerticalOption>> getVerticals();

  /// `GET /access/users?role=MANAGER&verticalId=` — managers for a sector.
  Future<List<ManagerOption>> getManagerOptions({String? verticalId});

  /// `GET /territories?verticalId=` — assignable territories, optionally
  /// scoped to one sector (Manager invite).
  Future<List<TerritoryOption>> getTerritoryOptions({String? verticalId});

  /// `GET /territories?managerId=&verticalId=` — **authoritative** server-side
  /// filter of patches valid inside that manager's zone (and sector), plus
  /// the zone outline/name for the REP territory picker.
  Future<ManagerTerritoryScope> getTerritoriesForManager(
    String managerId, {
    String? verticalId,
  });
}
