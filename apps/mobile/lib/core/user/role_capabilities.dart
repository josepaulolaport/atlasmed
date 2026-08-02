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

/// Spec 0006: admin creates zones + patches; manager creates patches only.
bool canCreateTerritory(UserRoleName role) =>
    role == UserRoleName.admin || role == UserRoleName.manager;

bool canCreateManagerZone(UserRoleName role) => role == UserRoleName.admin;

bool canCreateRepPatch(UserRoleName role) =>
    role == UserRoleName.admin || role == UserRoleName.manager;

/// Spec 0006: admin updates zones + patches; manager updates patches only.
bool canUpdateTerritory(UserRoleName role) =>
    role == UserRoleName.admin || role == UserRoleName.manager;

bool canUpdateManagerZone(UserRoleName role) => role == UserRoleName.admin;

bool canUpdateRepPatch(UserRoleName role) =>
    role == UserRoleName.admin || role == UserRoleName.manager;

bool canDeleteTerritory(UserRoleName role) => role == UserRoleName.admin;

bool canMutateFacility(UserRoleName role) =>
    role == UserRoleName.admin ||
    role == UserRoleName.manager ||
    role == UserRoleName.rep;

/// Spec 0006: clinic ownership assign/unassign — manager + admin (phase 1).
bool canAssignFacilityConsultant(UserRoleName role) =>
    role == UserRoleName.admin || role == UserRoleName.manager;

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

/// Ops Cadastro review queue (`read`/`update CADASTRO_SUBMISSION` on the API).
/// REP can upload docs via `update FACILITY` but cannot browse or approve.
bool canReviewCadastro(UserRoleName role) =>
    role == UserRoleName.admin ||
    role == UserRoleName.manager ||
    role == UserRoleName.ops;

bool canReadCatalog(UserRoleName role) =>
    role == UserRoleName.admin ||
    role == UserRoleName.manager ||
    role == UserRoleName.rep;

bool canManageCatalog(UserRoleName role) => role == UserRoleName.admin;

bool isAdmin(UserRoleName role) => role == UserRoleName.admin;
