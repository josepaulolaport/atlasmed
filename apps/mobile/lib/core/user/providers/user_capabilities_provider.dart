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
      ref.watch(userCapabilitiesProvider).valueOrNull?.can(.agenda, .read) ??
      false,
);

final canAgendaCreateProvider = Provider<bool>(
  (ref) =>
      ref.watch(userCapabilitiesProvider).valueOrNull?.can(.agenda, .create) ??
      false,
);

final canManageUserAdminProvider = Provider<bool>(
  (ref) =>
      ref.watch(userCapabilitiesProvider).valueOrNull?.can(.user, .manage) ??
      false,
);

final canLifecycleUserProvider = Provider<bool>(
  (ref) =>
      ref.watch(userCapabilitiesProvider).valueOrNull?.can(.user, .lifecycle) ??
      false,
);

final canCreateTerritoryProvider = Provider<bool>(
  (ref) =>
      ref
          .watch(userCapabilitiesProvider)
          .valueOrNull
          ?.can(.territory, .create) ??
      false,
);

final canCreateManagerZoneProvider = Provider<bool>(
  (ref) =>
      ref
          .watch(userCapabilitiesProvider)
          .valueOrNull
          ?.can(.territory, .create) ??
      false,
);

final canCreateRepPatchProvider = Provider<bool>(
  (ref) =>
      ref
          .watch(userCapabilitiesProvider)
          .valueOrNull
          ?.can(.territory, .create) ??
      false,
);

final canUpdateTerritoryProvider = Provider<bool>(
  (ref) =>
      ref
          .watch(userCapabilitiesProvider)
          .valueOrNull
          ?.can(.territory, .update) ??
      false,
);

final canUpdateManagerZoneProvider = Provider<bool>(
  (ref) =>
      ref
          .watch(userCapabilitiesProvider)
          .valueOrNull
          ?.can(.territory, .update) ??
      false,
);

final canUpdateRepPatchProvider = Provider<bool>(
  (ref) =>
      ref
          .watch(userCapabilitiesProvider)
          .valueOrNull
          ?.can(.territory, .update) ??
      false,
);

final canDeleteTerritoryProvider = Provider<bool>(
  (ref) =>
      ref
          .watch(userCapabilitiesProvider)
          .valueOrNull
          ?.can(.territory, .delete) ??
      false,
);

final canCreateFieldSuggestionProvider = Provider<bool>(
  (ref) =>
      ref
          .watch(userCapabilitiesProvider)
          .valueOrNull
          ?.can(.fieldSuggestion, .read) ??
      false,
);

final canReviewFieldSuggestionsProvider = Provider<bool>(
  (ref) =>
      ref
          .watch(userCapabilitiesProvider)
          .valueOrNull
          ?.can(.fieldSuggestion, .review) ??
      false,
);

final canAssignFacilityConsultantProvider = Provider<bool>(
  (ref) =>
      ref
          .watch(userCapabilitiesProvider)
          .valueOrNull
          ?.can(.facility, .update) ??
      false,
);

final canMutateProfessionalProvider = Provider<bool>(
  (ref) =>
      ref
          .watch(userCapabilitiesProvider)
          .valueOrNull
          ?.can(.professional, .update) ??
      false,
);

final canCreateVisitProvider = Provider<bool>(
  (ref) =>
      ref.watch(userCapabilitiesProvider).valueOrNull?.can(.agenda, .create) ??
      false,
);

final canManageUsersProvider = Provider<bool>(
  (ref) =>
      ref.watch(userCapabilitiesProvider).valueOrNull?.can(.user, .manage) ??
      false,
);

final canReviewCadastroProvider = Provider<bool>(
  (ref) =>
      ref
          .watch(userCapabilitiesProvider)
          .valueOrNull
          ?.can(.cadastro, .review) ??
      false,
);

final canReadTerritoriesProvider = Provider<bool>(
  (ref) =>
      ref.watch(userCapabilitiesProvider).valueOrNull?.can(.territory, .read) ??
      false,
);

final canMutateFacilityProvider = Provider<bool>(
  (ref) =>
      ref
          .watch(userCapabilitiesProvider)
          .valueOrNull
          ?.can(.facility, .update) ??
      false,
);

final canReadCatalogProvider = Provider<bool>(
  (ref) =>
      ref.watch(userCapabilitiesProvider).valueOrNull?.can(.catalog, .read) ??
      false,
);

final isAdminProvider = Provider<bool>(
  (ref) =>
      ref.watch(userCapabilitiesProvider).valueOrNull?.can(.user, .manage) ??
      false,
);
