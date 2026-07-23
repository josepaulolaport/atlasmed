import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/core/user/role_capabilities.dart';
import 'package:atlasmed_mobile_app/features/profile/presentation/providers/profile_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final currentUserRoleProvider = Provider<UserRoleName?>((ref) {
  return ref.watch(currentUserProvider).valueOrNull?.role.name;
});

bool _roleFlag(Ref ref, bool Function(UserRoleName role) predicate) {
  final role = ref.watch(currentUserRoleProvider);
  return role != null && predicate(role);
}

final canManageUsersProvider = Provider<bool>(
  (ref) => _roleFlag(ref, canManageUsers),
);

final canManageUserAdminProvider = Provider<bool>(
  (ref) => _roleFlag(ref, canManageUserAdmin),
);

final canLifecycleUserProvider = Provider<bool>(
  (ref) => _roleFlag(ref, canLifecycleUser),
);

final canCreateTerritoryProvider = Provider<bool>(
  (ref) => _roleFlag(ref, canCreateTerritory),
);

final canUpdateTerritoryProvider = Provider<bool>(
  (ref) => _roleFlag(ref, canUpdateTerritory),
);

final canDeleteTerritoryProvider = Provider<bool>(
  (ref) => _roleFlag(ref, canDeleteTerritory),
);

final canMutateFacilityProvider = Provider<bool>(
  (ref) => _roleFlag(ref, canMutateFacility),
);

final canMutateProfessionalProvider = Provider<bool>(
  (ref) => _roleFlag(ref, canMutateProfessional),
);

final canCreateVisitProvider = Provider<bool>(
  (ref) => _roleFlag(ref, canCreateVisit),
);

final canCreateFieldSuggestionProvider = Provider<bool>(
  (ref) => _roleFlag(ref, canCreateFieldSuggestion),
);

final canReviewFieldSuggestionsProvider = Provider<bool>(
  (ref) => _roleFlag(ref, canReviewFieldSuggestions),
);

final canReviewCadastroProvider = Provider<bool>(
  (ref) => _roleFlag(ref, canReviewCadastro),
);

final canManageCatalogProvider = Provider<bool>(
  (ref) => _roleFlag(ref, canManageCatalog),
);
