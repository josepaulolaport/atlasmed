# Phase 3 — Contract Bugs

**Goal:** Fix silent data bugs and broken API contracts. Things that look like they work but don't.  
**Rule:** Fix existing behavior only. No new endpoints unless required to fix the contract.  
**Status:** ⬜ Not started

---

## 1. Invite flow — assignment fields dropped

**The bug:** The web sends `firstName`, `lastName`, `managerId`, `managerTerritoryId`, `repTerritoryId` in the invite POST body. The API route only forwards `email`, `phoneNumber`, `roleId` to the use-case. All assignment data is silently dropped. Invited users arrive with no name and no territory assignment.

**Files to change:**
- `apps/api/src/modules/access/infrastructure/routes/invite-user.route.ts`
- `apps/api/src/modules/access/application/use-cases/invite-user.use-case.ts`
- `apps/api/src/modules/access/application/interfaces/invite.repository.interface.ts`

**Tasks:**
- [ ] Add `firstName`, `lastName` to the invite route body schema
- [ ] Add `managerId`, `managerTerritoryId`, `repTerritoryId` (optional, role-dependent)
- [ ] Pass fields through to the use-case
- [ ] Store them on the `Invitation` model (check schema — fields may need to be added in Phase 1)
- [ ] On registration (`POST /access/register`), populate `User.firstName`, `User.lastName` from the invite
- [ ] On registration, create the territory assignment from the invite's stored territory IDs
- [ ] Add/update integration tests covering the full invite → register flow with assignments
- [ ] Verify pt-BR error messages throughout

---

## 2. Manager selector — API ignores `?role=MANAGER`

**The bug:** `lib/api/users.ts` calls `GET /access/users?role=MANAGER` to populate the manager dropdown in the invite form. The API `list-users` endpoint does not accept or implement a `role` query param. All users are returned unfiltered.

**Files to change:**
- `apps/api/src/modules/access/infrastructure/routes/user-management.route.ts`
- `apps/api/src/modules/access/application/use-cases/list-users.use-case.ts`
- Possibly the repository interface + Prisma implementation

**Tasks:**
- [ ] Add optional `role` query param to the list-users route schema
- [ ] Pass it through to the use-case and repository filter
- [ ] Verify the manager selector in the web invite form now returns only MANAGER users
- [ ] Add test case for `?role=MANAGER` filter

---

## 3. Territory selector — API ignores type and manager filters

**The bug:** `lib/api/territories.ts` calls `GET /territory/territories?type=MANAGER_ZONE` and `?type=REP_PATCH&managerTerritoryId=...` to populate the invite form territory dropdowns. The API ignores both params and returns all territories.

**Files to change:**
- `apps/api/src/modules/territory/infrastructure/routes/territories.route.ts`
- `apps/api/src/modules/territory/application/use-cases/territory-crud.use-cases.ts`
- Territory repository interface + Prisma implementation

**Tasks:**
- [ ] Add optional `territoryTypeId` (or `type` slug) query param to the list-territories route
- [ ] Add optional `managerTerritoryId` query param to filter patches under a manager zone
- [ ] Implement the filter in the use-case and repository
- [ ] Verify the territory dropdowns in the invite form show the correct filtered results
- [ ] Add test cases for filtered queries

---

## 4. OPS role — empty scope

**The bug:** OPS is in the enum, in the migration, and in CASL abilities with read permissions. But the scope resolver returns an empty set for OPS users, so they see nothing despite having read rights. This was likely deferred from the OPS decision in Phase 1.

> **Depends on Phase 1 decision.** If OPS was removed in Phase 1, skip this. If OPS was kept, complete it here.

**Tasks (if OPS is kept):**
- [ ] Implement OPS scope in territory scope resolver — OPS sees all facilities (no territory filter) or a defined subset
- [ ] Add OPS to `ROLE_PRIORITY` in `packages/access`
- [ ] Add OPS test cases to `permission.middleware.test.ts`
- [ ] Add OPS user to seed data
- [ ] Verify OPS user can log in and read facilities/professionals via the web app

---

## 5. MANAGER — missing registry ingestion permissions

**The bug:** MANAGER cannot trigger or view registry ingestion runs. The CASL ability for `REGISTRY_INGESTION` is only granted to ADMIN.

**Tasks:**
- [ ] Decide: should MANAGER be able to view ingestion runs? trigger them?
- [ ] Update CASL abilities in `packages/access` accordingly
- [ ] Add test case
- [ ] Verify web UI shows/hides the relevant controls based on role

---

## Done criteria

- Invite flow correctly stores name and territory assignments; registered users arrive with assignments
- Manager dropdown in invite form shows only MANAGER users
- Territory dropdowns in invite form are correctly filtered
- OPS role either fully works or is fully removed (no half-state)
- MANAGER's access to registry ingestion is explicitly defined and tested
