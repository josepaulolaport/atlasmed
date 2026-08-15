import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';

/// Client-side mirrors of `@atlasmed/access` CASL helpers.
/// Backend remains the source of truth; these only hide nav/actions.

bool canManageUsers(UserRoleName role) =>
    role == UserRoleName.admin || role == UserRoleName.manager;

/// Equipe (spec 0014 §6): a manager sees their reps, an admin sees managers.
/// A REP has no team, so the roster is hidden from them entirely — the API
/// refuses it too, which is where the rule is actually enforced.
bool canReadTeam(UserRoleName role) =>
    role == UserRoleName.admin ||
    role == UserRoleName.manager ||
    role == UserRoleName.ops;

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

/// Who owns an agenda they can add to.
///
/// Not `canCreateVisit`: a manager may record a visit but reads agendas rather
/// than keeping one, so the create action stays with admin and rep. This lived
/// inline in `AgendaScreen`; scheduling now starts from clinic and doctor
/// detail too, and three copies of the rule drift.
bool canCreateCalendarEvent(UserRoleName role) =>
    role == UserRoleName.admin || role == UserRoleName.rep;

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

bool canReadAgenda(UserRoleName role) =>
    role == UserRoleName.admin ||
    role == UserRoleName.manager ||
    role == UserRoleName.rep;

bool canMutateAgenda(UserRoleName role) =>
    role == UserRoleName.admin || role == UserRoleName.rep;

bool canManageCatalog(UserRoleName role) => role == UserRoleName.admin;

bool isAdmin(UserRoleName role) => role == UserRoleName.admin;

/// Whether this role may import a clinic from CNES (spec 0015 §6.0).
///
/// Managers and admins only, for now. Not a permanent rule — it is the interim
/// answer to "may a rep import outside their patch", pending a product
/// decision. The API enforces the same rule independently; this only decides
/// whether the entry point is shown, so a rep is never offered an action that
/// would answer 403.
bool canImportFacilityFromCnes(UserRoleName role) =>
    role == UserRoleName.admin || role == UserRoleName.manager;
