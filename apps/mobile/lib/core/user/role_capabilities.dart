import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';

/// Client-side mirrors of `@atlasmed/access` CASL helpers.
/// Backend remains the source of truth; these only hide nav/actions.

bool canManageUsers(UserRoleName role) =>
    role == UserRoleName.admin || role == UserRoleName.manager;

/// Role change, grants, profile edit, territory/sector assignment replace.
bool canManageUserAdmin(UserRoleName role) => role == UserRoleName.admin;

/// Suspend / deactivate / activate / invite CRUD.
bool canLifecycleUser(UserRoleName role) =>
    role == UserRoleName.admin || role == UserRoleName.manager;

bool canReadTerritories(UserRoleName role) =>
    role == UserRoleName.admin ||
    role == UserRoleName.manager ||
    role == UserRoleName.ops;

bool canCreateTerritory(UserRoleName role) =>
    role == UserRoleName.admin || role == UserRoleName.manager;

bool canUpdateTerritory(UserRoleName role) =>
    role == UserRoleName.admin || role == UserRoleName.manager;

bool canDeleteTerritory(UserRoleName role) => role == UserRoleName.admin;

bool canMutateFacility(UserRoleName role) =>
    role == UserRoleName.admin ||
    role == UserRoleName.manager ||
    role == UserRoleName.rep;

bool canMutateProfessional(UserRoleName role) => canMutateFacility(role);

bool canCreateVisit(UserRoleName role) =>
    role == UserRoleName.admin ||
    role == UserRoleName.manager ||
    role == UserRoleName.rep;

bool canCreateFieldSuggestion(UserRoleName role) =>
    role == UserRoleName.admin ||
    role == UserRoleName.manager ||
    role == UserRoleName.rep;

/// Ops review queue (Não Conformidades). REP can submit suggestions but not
/// browse the queue (`cannot read FIELD_SUGGESTION` on the API).
bool canReadFieldSuggestions(UserRoleName role) =>
    role == UserRoleName.admin ||
    role == UserRoleName.manager ||
    role == UserRoleName.ops;

bool canReviewFieldSuggestions(UserRoleName role) =>
    role == UserRoleName.admin ||
    role == UserRoleName.manager ||
    role == UserRoleName.ops;

/// Cadastro review queue uses type-level `update FACILITY` on the API.
bool canReviewCadastro(UserRoleName role) => canMutateFacility(role);

bool canReadCatalog(UserRoleName role) =>
    role == UserRoleName.admin ||
    role == UserRoleName.manager ||
    role == UserRoleName.rep;

bool canManageCatalog(UserRoleName role) => role == UserRoleName.admin;

bool isAdmin(UserRoleName role) => role == UserRoleName.admin;
