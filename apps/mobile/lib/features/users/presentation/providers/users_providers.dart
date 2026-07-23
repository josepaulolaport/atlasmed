import 'package:atlasmed_mobile_app/core/user/models/user.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/assignment_option.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/permission_grant.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/user_assignments.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/user_invitation.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/providers/users_repository_providers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

export 'package:atlasmed_mobile_app/core/user/role_capability_providers.dart'
    show
        canLifecycleUserProvider,
        canManageUserAdminProvider,
        canManageUsersProvider;
export 'package:atlasmed_mobile_app/features/users/presentation/providers/users_list_notifier.dart';
export 'package:atlasmed_mobile_app/features/users/presentation/providers/users_list_state.dart';
export 'package:atlasmed_mobile_app/features/users/presentation/providers/users_repository_providers.dart';

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
