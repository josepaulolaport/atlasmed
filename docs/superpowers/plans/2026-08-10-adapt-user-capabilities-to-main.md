# Adapt User Capabilities to Main Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebase `feature/user-capabilities-20260805` onto `origin/main` and retain one typed `GET /api/v1/user/capabilities` endpoint whose mobile and web consumers mirror the current role-based backend authorization model.

**Architecture:** The API owns the app-facing resource/action vocabulary and derives a snapshot from `defineAbilitiesFor(role)` exported by `@atlasmed/access`. The access package remains the source of CASL role rules but gains no capability catalog, endpoint, grant adapter, or frontend DTO. Flutter decodes the snapshot defensively and replaces static role checks with capabilities whose action/resource pairs preserve the main branch’s existing UI visibility rules.

**Tech Stack:** Bun, TypeScript, Elysia, TypeBox, CASL, Flutter/Dart, Riverpod, Next.js.

---

## Confirmed starting state

- Branch commit `143613e9` is pushed to `origin/feature/user-capabilities-20260805`.
- The branch is **9 commits ahead and 5 commits behind** `origin/main`; its merge base is `331d1efb`.
- Main commit `a3e32ac5` removed AccessGrants, `defineAbilitiesForUser`, grants repositories/services, the old capability use case, capability route, user-permissions route, and the integration test suite under access.
- Main retains `defineAbilitiesFor(role)`, `canAccessRoute`, and role CASL rules in `packages/access/src/permissions/role.permissions.ts`; resource-instance permission currently has no extra rule beyond the role check.
- Main renamed the app’s professional subject to `PERSON` and moved API/user test fixture IDs from strings to numbers.
- The current branch’s `GET /api/v1/user/capabilities`, mobile repository URL, and web security consumer are correct as an HTTP boundary, but its computation still relies on removed grants and several mobile uses of `manage` do not match the intended MANAGER/REP UI behavior.

## Target contract

```ts
// GET /api/v1/user/capabilities
{
  version: 2,
  capabilities: [
    { resource: "facility", actions: ["read", "update"] },
    { resource: "territory", actions: ["read", "create", "update"] },
  ],
}
```

The endpoint is authenticated via the existing `userRoute` auth plugin. It is a type-level UI snapshot only: resource-specific visibility and mutation decisions remain enforced by the API’s `requirePermission` plus `getScope()`/DTO flags.

### Capability vocabulary and CASL mapping

| App resource/action | Main CASL check | Notes |
|---|---|---|
| `agenda.read/create/update/delete` | `CALENDAR` same action | ADMIN’s `manage CALENDAR` covers every action; MANAGER is read-only; REP has CRUD. |
| `catalog.read/manage` | `CATALOG` same action | Keep admin-only manage. |
| `cadastro.read/review` | `CADASTRO_SUBMISSION.read/update` | `review` remains an app alias for update. |
| `field-suggestion.read/review` | `FIELD_SUGGESTION.read/update` | `review` remains an app alias for update. |
| `facility.read/create/update/delete` | `FACILITY` same action | UI should use `update`, not `manage`, for manager/rep mutation controls. |
| `professional.read/update` | `PERSON.read/update` | `professional` stays the stable mobile DTO resource; only the backend CASL subject changes. |
| `territory.read/create/update/delete` | `TERRITORY` same action | UI should use `update` for manager/admin consultant-assignment controls. |
| `user.read/manage/lifecycle` | `USER.read/manage/update` | `manage` remains admin-only; `lifecycle` aliases update for manager/admin lifecycle controls. |

### Required mobile semantic corrections

| Current branch check | Replacement | Why |
|---|---|---|
| `manage facility` for clinic mutation/upload | `update facility` | Main grants MANAGER and REP update, but only ADMIN manage. |
| `manage professional` for professional mutation | `update professional` | Main grants MANAGER and REP update `PERSON`; preserve the existing `canMutateProfessional` behavior. |
| `manage territory` for consultant assignment | `update territory` | Main permits MANAGER update territory; admin’s manage covers update. |
| `manage user` for user navigation/list visibility | `read user` | Main permits MANAGER read user, matching the prior `canManageUsers` UI visibility. |
| `manage user` for admin-only identity/assignment edits | keep `manage user` | These replace `canManageUserAdmin`, which was admin-only. |
| `lifecycle user` for activation/suspension | keep `lifecycle user` | It aliases USER update and includes admin/manager. |

---

### Task 1: Establish the rebase checkpoint and resolve only structural conflicts

**Files:**
- Modify: every conflict reported by `git rebase origin/main`
- Delete: stale grant/capability files that `origin/main` deleted
- Preserve: `docs/architecture/features/access-auth.md`

- [ ] **Step 1: Start from a clean, pushed branch and fetch the exact base**

Run:

```bash
git status --short
git fetch origin main
git rev-parse HEAD
git rev-parse origin/main
```

Expected: clean worktree; HEAD resolves to `143613e9` or its descendant; `origin/main` resolves to the latest remote commit.

- [ ] **Step 2: Create a safety branch before replaying commits**

Run:

```bash
git branch backup/user-capabilities-before-main-rebase
git rebase origin/main
```

Expected: conflicts in old AccessGrants/capability files and the main-rewritten mobile/app/web files; do not resolve by restoring grant infrastructure.

- [ ] **Step 3: Accept main-side deletion for removed AccessGrants surfaces**

During the rebase, remove rather than restore these branch-only/deleted surfaces:

```text
apps/api/src/modules/access/application/interfaces/access-grant.repository.interface.ts
apps/api/src/modules/access/application/services/access-grant.service.ts
apps/api/src/modules/access/application/use-cases/grant-permission.use-case.ts
apps/api/src/modules/access/application/use-cases/revoke-permission.use-case.ts
apps/api/src/modules/access/infrastructure/cache/access-grant-cache.service.ts
apps/api/src/modules/access/infrastructure/repositories/drizzle/drizzle-access-grant.repository.ts
apps/api/src/modules/access/infrastructure/routes/user-permissions.route.ts
packages/access/src/contracts/access-grant.contract.ts
packages/access/src/permissions/grant-conditions.ts
packages/access/src/permissions/grant.permissions.ts
packages/access/src/scope/scope-grant.helpers.ts
```

Resolution rule: use `git rm` for each survivor; do not add compatibility stubs. Main has explicitly retired resource-scoped overrides.

- [ ] **Step 4: Keep the user endpoint and consumer work, but defer its implementation conflict**

Retain the conceptual changes to:

```text
apps/api/src/modules/access/infrastructure/routes/user.route.ts
apps/api/src/modules/access/infrastructure/routes/user.route.test.ts
apps/mobile/lib/core/user/models/app_capability.dart
apps/mobile/lib/core/user/models/user_capabilities.dart
apps/mobile/lib/core/user/providers/user_capabilities_provider.dart
apps/mobile/lib/core/user/repositories/user_capabilities_repository.dart
apps/mobile/lib/shared/widgets/can.dart
apps/web/app/(dashboard)/security/page.tsx
apps/web/lib/api/auth.ts
apps/web/types/auth.ts
```

Resolve structural conflict markers using the current `origin/main` layout first. Implement the endpoint/service behavior in Tasks 2–4 rather than preserving any branch code that imports grants.

- [ ] **Step 5: Complete the rebase only after no conflict markers remain**

Run:

```bash
git diff --check
git diff --name-only --diff-filter=U
git rebase --continue
```

Expected: `git diff --name-only --diff-filter=U` produces no paths. If later commits conflict, repeat the same main-first rule. Do not push until Task 6 passes.

---

### Task 2: Rebuild role-derived API capability computation without changing `packages/access`

**Files:**
- Create: `apps/api/src/modules/access/application/services/app-capabilities.ts`
- Create: `apps/api/src/modules/access/application/services/app-capabilities.test.ts`
- Create: `apps/api/src/modules/access/application/use-cases/get-capabilities.use-case.ts`
- Create: `apps/api/src/modules/access/application/use-cases/get-capabilities.use-case.test.ts`
- Modify: `apps/api/src/modules/access/composition.ts`

- [ ] **Step 1: Write failing service tests against main role rules**

Create `app-capabilities.test.ts` with direct calls to the service and assert role-derived snapshots. At minimum:

```ts
import { describe, expect, it } from "bun:test";
import { Role } from "@atlasmed/access";
import { getAppCapabilities } from "./app-capabilities";

describe("getAppCapabilities", () => {
  it("maps MANAGER role abilities to app resources and aliases", () => {
    expect(getAppCapabilities(Role.MANAGER)).toEqual(
      expect.arrayContaining([
        { resource: "facility", actions: expect.arrayContaining(["read", "update"]) },
        { resource: "professional", actions: expect.arrayContaining(["read", "update"]) },
        { resource: "territory", actions: expect.arrayContaining(["read", "create", "update"]) },
        { resource: "user", actions: expect.arrayContaining(["read", "lifecycle"]) },
      ]),
    );
  });

  it("does not grant MANAGER admin-only or representative agenda actions", () => {
    const capabilities = getAppCapabilities(Role.MANAGER);
    expect(capabilities).not.toContainEqual({
      resource: "agenda",
      actions: expect.arrayContaining(["create"]),
    });
    expect(capabilities).not.toContainEqual({
      resource: "user",
      actions: expect.arrayContaining(["manage"]),
    });
  });
});
```

Run:

```bash
cd apps/api
NODE_ENV=test bun test src/modules/access/application/services/app-capabilities.test.ts
```

Expected: failure because the service does not yet exist.

- [ ] **Step 2: Implement the API-owned catalog and role mapping**

Implement `app-capabilities.ts` using only current main exports:

```ts
import { defineAbilitiesFor, type Action, type Role, type Subject } from "@atlasmed/access";

export const APP_CAPABILITY_ACTIONS = {
  agenda: ["read", "create", "update", "delete"],
  catalog: ["read", "manage"],
  cadastro: ["read", "review"],
  "field-suggestion": ["read", "review"],
  facility: ["read", "create", "update", "delete"],
  professional: ["read", "update"],
  territory: ["read", "create", "update", "delete"],
  user: ["read", "manage", "lifecycle"],
} as const;

type CapabilityCheck = { action: Action; subject: Subject };
```

Use a private `CAPABILITY_CHECKS` map with `professional -> PERSON`, `review -> update`, and `lifecycle -> update`. For each declared action call `defineAbilitiesFor(role).can(check.action, check.subject)`. Export only `APP_CAPABILITY_ACTIONS`, `AppCapability`, and `getAppCapabilities` from this API-local file. Do not add an export to `packages/access/src/index.ts`.

- [ ] **Step 3: Verify the service tests turn green**

Run:

```bash
cd apps/api
NODE_ENV=test bun test src/modules/access/application/services/app-capabilities.test.ts
```

Expected: all capability mapping tests pass.

- [ ] **Step 4: Write the failing use-case tests**

Create `get-capabilities.use-case.test.ts` using the main `createMockUserRepository` pattern. Verify that the use case returns `{ version: 2, capabilities }` for a persisted role and throws `UserNotFoundError` when `findById` returns `null`.

Run:

```bash
cd apps/api
NODE_ENV=test bun test src/modules/access/application/use-cases/get-capabilities.use-case.test.ts
```

Expected: failure because the use case does not yet exist.

- [ ] **Step 5: Implement the no-grant use case and wire it in composition**

Implement the use case with a single dependency:

```ts
interface Dependencies {
  userRepository: UserRepository;
}

async execute({ userId }: { userId: number }) {
  const user = await this.deps.userRepository.findById(userId);
  if (!user) throw new UserNotFoundError(userId);

  return {
    version: 2 as const,
    capabilities: getAppCapabilities(user.role.name),
  };
}
```

In `composition.ts`, import `GetCapabilitiesUseCase` and add:

```ts
getCapabilities: () => new GetCapabilitiesUseCase({
  userRepository: accessRepositories.user,
}),
```

Do not instantiate or import an AccessGrant repository/service.

- [ ] **Step 6: Verify use-case and service tests**

Run:

```bash
cd apps/api
NODE_ENV=test bun test \
  src/modules/access/application/services/app-capabilities.test.ts \
  src/modules/access/application/use-cases/get-capabilities.use-case.test.ts
```

Expected: all tests pass.

---

### Task 3: Add the canonical API endpoint to main’s authenticated user route

**Files:**
- Modify: `apps/api/src/modules/access/infrastructure/routes/user.route.ts`
- Modify: `apps/api/src/modules/access/infrastructure/routes/user.route.test.ts`
- Modify: `apps/api/src/modules/access/test-helpers/route-test-context.ts`
- Modify: `apps/api/src/test-utils/route-security.manifest.ts` only if the main file still needs an entry adjustment

- [ ] **Step 1: Write a failing user-route test for the canonical URL**

Extend main’s `routeTestContext.mocks` with:

```ts
getCapabilitiesExecute: mock(async () => ({
  version: 2 as const,
  capabilities: [{ resource: "agenda", actions: ["read"] }],
})),
```

In the user route test harness, add `/user/capabilities` using that mock. Add a test that requests `http://localhost/user/capabilities`, asserts HTTP 200, verifies the mock received `{ userId: fullUser.id }`, and asserts the typed snapshot payload.

Run:

```bash
cd apps/api
NODE_ENV=test bun test src/modules/access/infrastructure/routes/user.route.test.ts
```

Expected: failure until the actual route is registered.

- [ ] **Step 2: Add the Elysia route and response schema**

In `user.route.ts`, import `APP_CAPABILITY_ACTIONS` and `AppCapability` from the API-local service. Define the existing-branch `t.Unsafe<AppCapability[]>` discriminated `oneOf` schema near the imports. Add this authenticated route directly after `GET /user`:

```ts
.get(
  "/user/capabilities",
  async ({ getUserId }: any) =>
    accessUseCases.getCapabilities().execute({ userId: await getUserId() }),
  {
    response: {
      200: t.Object({
        version: t.Literal(2),
        capabilities: capabilityResponseSchema,
      }),
    },
    detail: {
      summary: "Get authenticated user capabilities",
      description: "Returns the authenticated user's typed capability snapshot grouped by resource.",
      tags: ["User"],
      security: [{ bearerAuth: [] }],
    },
  },
)
```

Do not recreate an `/access` prefix, `/me/capabilities`, a v1 response, or a `/v2` suffix. The main app already mounts `userRoute` as `/api/v1/user`.

- [ ] **Step 3: Verify the route test passes and auth classification remains accurate**

Run:

```bash
cd apps/api
NODE_ENV=test bun test \
  src/modules/access/infrastructure/routes/user.route.test.ts \
  src/test-utils/route-security.manifest.test.ts
```

Expected: all pass. The endpoint inherits the `auth` classification of `user.route.ts`; no new route module is created.

---

### Task 4: Reapply typed mobile capabilities on top of main’s app structure

**Files:**
- Create: `apps/mobile/lib/core/user/models/app_capability.dart`
- Create: `apps/mobile/lib/core/user/models/user_capabilities.dart`
- Create: `apps/mobile/lib/core/user/providers/user_capabilities_provider.dart`
- Create: `apps/mobile/lib/core/user/repositories/user_capabilities_repository.dart`
- Create: `apps/mobile/lib/shared/widgets/can.dart`
- Create: `apps/mobile/test/core/user/user_capabilities_test.dart`
- Modify: `apps/mobile/lib/core/user/role_capability_providers.dart`
- Modify: `apps/mobile/lib/app.dart`
- Modify: `apps/mobile/lib/shared/widgets/app_shell.dart`
- Modify: the exact feature call sites listed in the mobile semantic-corrections table above
- Modify: `apps/mobile/test/shared/widgets/app_shell_test.dart`

- [ ] **Step 1: Write failing parser tests**

Create `user_capabilities_test.dart`:

```dart
test('decodes typed resource actions and ignores unknown values', () {
  final capabilities = UserCapabilities.fromJson({
    'version': 2,
    'capabilities': [
      {'resource': 'agenda', 'actions': ['read', 'unknown.future.action']},
      {'resource': 'unknown.future.resource', 'actions': ['read']},
      {'resource': 'facility', 'actions': ['update']},
    ],
  });

  expect(capabilities.version, 2);
  expect(capabilities.can(.read, .agenda), isTrue);
  expect(capabilities.can(.update, .facility), isTrue);
  expect(capabilities.capabilities.length, 2);
});
```

Run:

```bash
cd apps/mobile
fvm flutter test test/core/user/user_capabilities_test.dart
```

Expected: failure because the model is absent.

- [ ] **Step 2: Add typed model, defensive decoding, repository, provider, and `Can`**

Restore the branch’s `CapabilityResource`/`CapabilityAction` enums, preserving wire values such as `field-suggestion`. `UserCapabilities.fromJson` must ignore unknown resource/action values. The repository endpoint must be exactly:

```dart
Uri.parse('${AppConfig.apiBaseUrl}/api/v1/user/capabilities')
```

`userCapabilitiesProvider` reads the repository’s current value and defaults all UI checks to false until it resolves. `Can` watches the provider and supplies the boolean to its builder.

- [ ] **Step 3: Run parser test green**

Run:

```bash
cd apps/mobile
fvm flutter test test/core/user/user_capabilities_test.dart
```

Expected: pass.

- [ ] **Step 4: Replace main’s app-level static role gating**

In `app.dart`, replace the agenda redirect’s `canReadAgenda(user.role.name)` check with `userCapabilitiesProvider?.can(.read, .agenda) ?? false` while retaining the safe behavior that a still-unresolved snapshot does not flash an authorized route.

In `app_shell.dart`:

1. Change `AppNavigationItem.visibleFor` from `bool Function(UserRoleName role)?` to `bool Function(WidgetRef ref)?`.
2. Make `appNavigationItems` `final` rather than `const`.
3. Use the provider checks below:

```dart
agenda: .can(.read, .agenda)
territories: .can(.read, .territory)
users: .can(.read, .user)
registrations: .can(.review, .cadastro)
nonConformities: .can(.read, .fieldSuggestion)
products: .can(.read, .catalog)
```

4. Pass `WidgetRef` into `AtlasDrawerNavigation` rather than a resolved role.

Update app-shell tests to override the capabilities provider and prove unauthorized navigation items remain absent.

- [ ] **Step 5: Migrate feature controls with the corrected action pairs**

Apply the semantic-corrections table exactly:

```text
clinic_detail_screen.dart                         update facility; create field-suggestion; create agenda; update territory
clinic_header_section.dart                        update facility
administrative_professionals_list_screen.dart     update professional
doctors_list_screen.dart                          update professional
representative_detail_screen.dart                 update professional
clinic_admin_info_section.dart                    create field-suggestion
territories_screen.dart                           create/update/delete territory; update territory for assignment; read user for visibility
territory_metadata_form.dart                      create territory
users_screen.dart                                 read user
user_detail_screen.dart                           lifecycle user; manage user only for admin controls
edit_user_profile_screen.dart                     manage user
edit_user_assignments_screen.dart                 manage user
cadastro_review_detail_screen.dart                review cadastro
nao_conformidade_detail_screen.dart               review field-suggestion
agenda_route_guards.dart                          read/create agenda
```

Keep `role_capability_providers.dart` as a compatibility re-export only if imports remain during the migration; remove the static provider declarations. After call sites move, delete imports of `role_capabilities.dart` from production mobile code. Retain `role_capabilities.dart` temporarily only if it remains used by un-migrated tests; otherwise delete it and update tests in the same change.

- [ ] **Step 6: Verify focused mobile tests and analyzer**

Run:

```bash
cd apps/mobile
fvm flutter test \
  test/core/user/user_capabilities_test.dart \
  test/shared/widgets/app_shell_test.dart
fvm flutter analyze
fvm dart format --set-exit-if-changed lib test
```

Expected: focused tests pass, analyzer reports no issues, formatter reports zero changed files.

---

### Task 5: Preserve the web security consumer on the typed canonical contract

**Files:**
- Modify: `apps/web/types/auth.ts`
- Modify: `apps/web/lib/api/auth.ts`
- Modify: `apps/web/app/(dashboard)/security/page.tsx`

- [ ] **Step 1: Update the client type and canonical URL**

Replace the old role/grants response interface with:

```ts
export interface CapabilitiesResponse {
  version: 2;
  capabilities: Array<{ resource: string; actions: string[] }>;
}
```

Make `authApi.getCapabilities()` call `/user/capabilities`, not `/access/me/capabilities`.

- [ ] **Step 2: Render the typed snapshot without manufacturing grant metadata**

Keep the security card and its existing loading/error states. Replace the old role/grants list with one item per capability:

```tsx
{capabilities.capabilities.map((capability) => (
  <li key={capability.resource} className="rounded-md border border-zinc-200 bg-white px-3 py-2">
    <span className="font-medium text-zinc-900">{capability.resource}</span>
    <span className="text-zinc-500">{": "}{capability.actions.join(", ")}</span>
  </li>
))}
```

The empty state is `Nenhuma permissão disponível.` Do not display a role, grant ID, expiration, or resource ID because the endpoint deliberately does not return them.

- [ ] **Step 3: Verify web consumer**

Run:

```bash
bun run web:typecheck
bun run web:lint
```

Expected: both return exit code 0. Existing unrelated warnings may remain if the repository’s lint configuration permits warnings.

---

### Task 6: Final verification, PR reconciliation, and documentation

**Files:**
- Modify: `docs/architecture/features/access-auth.md`
- Modify: `apps/api/src/modules/access/access-http.integration.test.ts` only if a replacement main integration harness is intentionally introduced; otherwise do not restore deleted integration fixtures.

- [ ] **Step 1: Update documentation to the final role-based semantics**

Keep these statements accurate:

```markdown
Mobile authorization reads `GET /api/v1/user/capabilities` and caches `{ version: 2, capabilities: [{ resource, actions }] }`.
The snapshot is derived from backend role CASL permissions; AccessGrants are not part of the endpoint.
Unknown future resources and actions are ignored safely by mobile.
The snapshot controls type-level UI visibility only; backend authorization and scope remain authoritative.
```

Remove references to v1, `/v2`, `/me/capabilities`, active grants, or resource-scoped grant overrides.

- [ ] **Step 2: Run API checks**

Run:

```bash
bun run api:typecheck
bun run api:lint
cd apps/api
NODE_ENV=test bun test \
  src/modules/access/application/services/app-capabilities.test.ts \
  src/modules/access/application/use-cases/get-capabilities.use-case.test.ts \
  src/modules/access/infrastructure/routes/user.route.test.ts
```

Expected: all pass. If the test environment logs a Redis connection error but tests pass, record it as an environment log only; do not mask an actual failing test.

- [ ] **Step 3: Run complete mobile checks**

Run:

```bash
cd apps/mobile
fvm flutter analyze
fvm dart format --set-exit-if-changed lib test
fvm flutter test
```

Expected: analyzer has no issues, formatter has zero changes, full suite passes.

- [ ] **Step 4: Confirm endpoint and dead-code cleanup**

Run:

```bash
git grep -nE 'me/capabilities|capabilities/v2|capabilities\.route|defineAbilitiesForUser|AccessGrantService' -- \
  apps/api apps/mobile apps/web packages/access docs || true
git diff --check
git status --short
```

Expected: no old capability endpoint references; no grant-based capability implementation; no whitespace errors.

- [ ] **Step 5: Review, commit, and push after verification**

Run:

```bash
git add apps/api apps/mobile apps/web packages/access docs/architecture/features/access-auth.md
git commit -m "feat(capabilities): align snapshot with role access"
git push --force-with-lease origin feature/user-capabilities-20260805
```

Use `--force-with-lease` only because a rebase changes the branch history. Before pushing, verify the branch is still yours and `git status --short` is clean. Do not use plain `--force`.
