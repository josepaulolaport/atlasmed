import 'package:atlasmed_mobile_app/core/user/models/user.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/features/profile/presentation/providers/profile_provider.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/assignment_option.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/permission_grant.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/user_assignments.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/user_invitation.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/providers/users_repository_providers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

export 'package:atlasmed_mobile_app/features/users/presentation/providers/users_list_notifier.dart';
export 'package:atlasmed_mobile_app/features/users/presentation/providers/users_list_state.dart';
export 'package:atlasmed_mobile_app/features/users/presentation/providers/users_repository_providers.dart';

/// Whether the signed-in user can access User Management at all. Unlike
/// territories (read-only for non-admins), this screen is admin-only end
/// to end — the backend's `manage USER` / role-change / grant rules are
/// effectively ADMIN-exclusive, so the mobile UI mirrors that instead of
/// showing a partial read-only view. Defaults to `false` while the session
/// is still resolving or on error.
final canManageUsersProvider = Provider<bool>((ref) {
  final user = ref.watch(currentUserProvider).valueOrNull;
  return user?.role.name == UserRoleName.admin;
});

/// Looks up a single user by id — used by the detail screen and by the
/// change-role sheet's initial selection.
final userDetailProvider = FutureProvider.autoDispose.family<User?, String>((
  ref,
  id,
) {
  return ref.watch(usersRepositoryProvider).getUserById(id);
});

final userAssignmentsProvider = FutureProvider.autoDispose
    .family<UserAssignments, String>((ref, userId) {
      return ref.watch(usersRepositoryProvider).getUserAssignments(userId);
    });

final userPermissionsProvider = FutureProvider.autoDispose
    .family<List<PermissionGrant>, String>((ref, userId) {
      return ref.watch(usersRepositoryProvider).getUserPermissions(userId);
    });

final rolesProvider = FutureProvider.autoDispose<List<UserRole>>((ref) {
  return ref.watch(usersRepositoryProvider).getRoles();
});

final managerOptionsProvider = FutureProvider.autoDispose<List<ManagerOption>>((
  ref,
) {
  return ref.watch(usersRepositoryProvider).getManagerOptions();
});

/// Managers operating in a given sector (`GET …&sectorId=`).
final managersForSectorProvider = FutureProvider.autoDispose
    .family<List<ManagerOption>, String>((ref, sectorId) {
      return ref
          .watch(usersRepositoryProvider)
          .getManagerOptions(sectorId: sectorId);
    });

final territoryOptionsProvider =
    FutureProvider.autoDispose<List<TerritoryOption>>((ref) {
      return ref.watch(usersRepositoryProvider).getTerritoryOptions();
    });

/// Territories in a given sector (`GET /territories?sectorId=`).
final territoriesForSectorProvider = FutureProvider.autoDispose
    .family<List<TerritoryOption>, String>((ref, sectorId) {
      return ref
          .watch(usersRepositoryProvider)
          .getTerritoryOptions(sectorId: sectorId);
    });

final sectorOptionsProvider = FutureProvider.autoDispose<List<SectorOption>>((
  ref,
) {
  return ref.watch(usersRepositoryProvider).getSectors();
});

final invitationsListProvider =
    FutureProvider.autoDispose<List<UserInvitation>>((ref) {
      return ref.watch(invitationsRepositoryProvider).getInvitations();
    });

final invitationDetailProvider = FutureProvider.autoDispose
    .family<UserInvitation, String>((ref, id) {
      return ref.watch(invitationsRepositoryProvider).getInvitation(id);
    });
