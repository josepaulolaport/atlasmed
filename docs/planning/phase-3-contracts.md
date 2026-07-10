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

## 4. OPS role — global read-only scope

> **Done in Phase 1.** OPS uses `createGlobalScopeContext()` (read all data; CASL denies writes). Verify end-to-end after sector scoping lands in §6.

**Tasks:**
- [x] Implement OPS scope in `ScopeResolver`
- [x] OPS in `ROLE_PRIORITY_BY_NAME`
- [ ] Add OPS user to seed data (if not already present)
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

## 6. Healthcare sector scoping (application layer)

**Context:** Phase 1 added schema hooks only (`territories.sector_id`, `user_sector_assignments`). This section wires sector through access, territory, invite, and list APIs.

**Model:** A territory belongs to **one sector**. A user operates in **one or more sectors**. Effective scope is the **intersection** of territory assignments and sector assignments:

```
visibleTerritories(user) = assignedTerritories(user) ∩ territoriesWhere(sector ∈ user.sectors)
```

**Backend — scope & repositories:**
- [ ] Extend `ScopeContext` with `assignedSectorIds: string[]`
- [ ] Load sector IDs in `ScopeResolver` (new `ScopeRepository.findSectorIdsByUserId`)
- [ ] Filter `assignedTerritoryIds` / `effectiveTerritoryIds` to territories whose `sector_id` is in the user's sectors (REP + MANAGER paths)
- [ ] ADMIN / OPS: skip sector filter (global)
- [ ] Add validation service: cannot assign territory T to user U unless `T.sector_id ∈ U.sector_ids`
- [ ] Facility list/detail queries: optional sector filter for managers viewing cross-territory analytics

**Backend — territory & user APIs:**
- [ ] `GET /territory/territories` — add optional `sectorId` query param (combine with type/manager filters from §3)
- [ ] Territory create/update — require `sectorId` on assignable territory types
- [ ] User sector assignment CRUD (assign/revoke sectors on manager/rep profiles)
- [ ] Invite flow — when inviting REP/MANAGER, assign sectors + validate territory sector alignment

**Backend — invite integration (extends §1):**
- [ ] Store `sectorIds` on invitation or derive from `repTerritoryId.sector_id` at accept time
- [ ] On register/accept: create `user_sector_assignments` rows alongside territory assignments

**Web:**
- [ ] Sector multi-select on invite form (manager/rep roles)
- [ ] Filter territory dropdowns by selected sector(s)
- [ ] User profile: show/edit assigned sectors (admin/manager)
- [ ] Optional sector filter on facility list for managers with multiple sectors

**Tests:**
- [ ] Unit: scope resolver filters territories by sector intersection
- [ ] Integration: manager with sectors A+B only sees territories in A+B
- [ ] Integration: rep cannot access territory in unassigned sector even if row exists in `user_territory_assignments`
- [ ] Integration: invite → register creates sector + territory assignments

**Data integrity (optional hardening):**
- [ ] Validate `facilities.primary_sector_id` matches `facilities.territory.sector_id` when both set (warn or block)

---

## Done criteria

- Invite flow correctly stores name, sector, and territory assignments; registered users arrive with assignments
- Manager dropdown in invite form shows only MANAGER users
- Territory dropdowns in invite form are correctly filtered by type, manager zone, **and sector**
- OPS role reads globally; writes remain denied
- MANAGER's access to registry ingestion is explicitly defined and tested
- **Sector scoping enforced server-side** on all scoped modules (access, territory, facility, catalog)
