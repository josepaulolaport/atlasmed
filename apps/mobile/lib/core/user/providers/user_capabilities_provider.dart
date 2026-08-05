import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:atlasmed_mobile_app/core/session/providers/session_provider.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_capabilities.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/core/user/repositories/user_capabilities_repository.dart';
import 'package:atlasmed_mobile_app/features/profile/presentation/providers/profile_provider.dart';

final userCapabilitiesRepositoryProvider = Provider<UserCapabilitiesRepository>(
  (ref) {
    return UserCapabilitiesRepository();
  },
);

final userCapabilitiesProvider = FutureProvider<UserCapabilities?>((ref) async {
  ref.watch(sessionProvider);
  final repository = ref.watch(userCapabilitiesRepositoryProvider);
  return repository.currentValueOrResolve();
});

final currentUserCapabilitiesProvider = Provider<AsyncValue<UserCapabilities?>>(
  (ref) {
    return ref.watch(userCapabilitiesProvider);
  },
);

final currentUserRoleProvider = Provider<UserRoleName?>((ref) {
  return ref.watch(currentUserProvider).valueOrNull?.role.name;
});

final canAgendaReadProvider = Provider<bool>(
  (ref) =>
      ref.watch(userCapabilitiesProvider).valueOrNull?.can(.read, .agenda) ??
      false,
);

final canAgendaCreateProvider = Provider<bool>(
  (ref) =>
      ref.watch(userCapabilitiesProvider).valueOrNull?.can(.create, .agenda) ??
      false,
);

final canManageUserAdminProvider = Provider<bool>(
  (ref) =>
      ref.watch(userCapabilitiesProvider).valueOrNull?.can(.manage, .user) ??
      false,
);

final canLifecycleUserProvider = Provider<bool>(
  (ref) =>
      ref.watch(userCapabilitiesProvider).valueOrNull?.can(.lifecycle, .user) ??
      false,
);

final canCreateTerritoryProvider = Provider<bool>(
  (ref) =>
      ref
          .watch(userCapabilitiesProvider)
          .valueOrNull
          ?.can(.create, .territory) ??
      false,
);

final canCreateManagerZoneProvider = Provider<bool>(
  (ref) =>
      ref
          .watch(userCapabilitiesProvider)
          .valueOrNull
          ?.can(.create, .territory) ??
      false,
);

final canCreateRepPatchProvider = Provider<bool>(
  (ref) =>
      ref
          .watch(userCapabilitiesProvider)
          .valueOrNull
          ?.can(.create, .territory) ??
      false,
);

final canUpdateTerritoryProvider = Provider<bool>(
  (ref) =>
      ref
          .watch(userCapabilitiesProvider)
          .valueOrNull
          ?.can(.update, .territory) ??
      false,
);

final canUpdateManagerZoneProvider = Provider<bool>(
  (ref) =>
      ref
          .watch(userCapabilitiesProvider)
          .valueOrNull
          ?.can(.update, .territory) ??
      false,
);

final canUpdateRepPatchProvider = Provider<bool>(
  (ref) =>
      ref
          .watch(userCapabilitiesProvider)
          .valueOrNull
          ?.can(.update, .territory) ??
      false,
);

final canDeleteTerritoryProvider = Provider<bool>(
  (ref) =>
      ref
          .watch(userCapabilitiesProvider)
          .valueOrNull
          ?.can(.delete, .territory) ??
      false,
);

final canCreateFieldSuggestionProvider = Provider<bool>(
  (ref) =>
      ref
          .watch(userCapabilitiesProvider)
          .valueOrNull
          ?.can(.read, .fieldSuggestion) ??
      false,
);

final canReviewFieldSuggestionsProvider = Provider<bool>(
  (ref) =>
      ref
          .watch(userCapabilitiesProvider)
          .valueOrNull
          ?.can(.review, .fieldSuggestion) ??
      false,
);

final canAssignFacilityConsultantProvider = Provider<bool>(
  (ref) =>
      ref
          .watch(userCapabilitiesProvider)
          .valueOrNull
          ?.can(.update, .facility) ??
      false,
);

final canMutateProfessionalProvider = Provider<bool>(
  (ref) =>
      ref
          .watch(userCapabilitiesProvider)
          .valueOrNull
          ?.can(.update, .professional) ??
      false,
);

final canCreateVisitProvider = Provider<bool>(
  (ref) =>
      ref.watch(userCapabilitiesProvider).valueOrNull?.can(.create, .agenda) ??
      false,
);

final canManageUsersProvider = Provider<bool>(
  (ref) =>
      ref.watch(userCapabilitiesProvider).valueOrNull?.can(.manage, .user) ??
      false,
);

final canReviewCadastroProvider = Provider<bool>(
  (ref) =>
      ref
          .watch(userCapabilitiesProvider)
          .valueOrNull
          ?.can(.review, .cadastro) ??
      false,
);

final canReadTerritoriesProvider = Provider<bool>(
  (ref) =>
      ref.watch(userCapabilitiesProvider).valueOrNull?.can(.read, .territory) ??
      false,
);

final canMutateFacilityProvider = Provider<bool>(
  (ref) =>
      ref
          .watch(userCapabilitiesProvider)
          .valueOrNull
          ?.can(.update, .facility) ??
      false,
);

final canReadCatalogProvider = Provider<bool>(
  (ref) =>
      ref.watch(userCapabilitiesProvider).valueOrNull?.can(.read, .catalog) ??
      false,
);

final isAdminProvider = Provider<bool>(
  (ref) =>
      ref.watch(userCapabilitiesProvider).valueOrNull?.can(.manage, .user) ??
      false,
);
