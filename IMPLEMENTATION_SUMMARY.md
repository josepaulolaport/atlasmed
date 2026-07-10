# Backend User Invitation Restructuring - Implementation Summary

## Overview
Successfully restructured the backend invitation system to support role-based territory assignments for ADMIN, MANAGER, REP (formerly USER), and OPS roles.

## Completed Changes

### 1. Database Migrations ✅

**Migration 1: `20260709210000_rename_user_role_to_rep_and_add_ops`**
- Renamed USER role to REP in the roles table
- Added OPS role with priority 20 (between REP=10 and MANAGER=50)

**Migration 2: `20260709210001_add_invitation_assignment_fields`**
- Added `firstName`, `lastName` to invitations
- Added `managerId` with foreign key to users table
- Added `managerTerritoryId` with foreign key to territories table
- Added `repTerritoryId` with foreign key to territories table
- Created appropriate indexes for all foreign keys

### 2. Prisma Schema Updates ✅

**Updated `Invitation` model:**
- Added name fields (firstName, lastName)
- Added manager assignment field (managerId)
- Added territory assignment fields (managerTerritoryId, repTerritoryId)
- Added relations to User and Territory models

**Updated `User` model:**
- Added `managerInvitations` relation for invitation manager tracking

**Updated `Territory` model:**
- Added `managerTerritoryInvitations` and `repTerritoryInvitations` relations

### 3. Role System Updates ✅

**packages/access/src/enums/role.enum.ts**
- Renamed `USER` → `REP`
- Added `OPS` role

**apps/api/src/modules/access/application/constants/role-priority.constants.ts**
- Updated priority mapping:
  - ADMIN: 100
  - MANAGER: 50
  - OPS: 20
  - REP: 10

### 4. CASL Permissions ✅

**packages/access/src/permissions/role.permissions.ts**
- Renamed `USER` case to `REP` with same permissions
- Added `OPS` case with read-only permissions:
  - Can read: FACILITY, PROFESSIONAL, VISIT, TERRITORY, USER
  - Cannot create/update/delete anything

### 5. Invitation Schema & Validation ✅

**packages/access/src/schemas/invite-user.schema.ts**
- Added required `firstName` and `lastName` fields
- Added optional `managerId`, `managerTerritoryId`, `repTerritoryId` fields

**New Service: `invitation-territory-validator.service.ts`**
- Validates MANAGER invitations require `managerTerritoryId`
- Validates REP invitations require both `managerId` and `repTerritoryId`
- Ensures manager has MANAGER role
- Validates territory types (manager_zone for managers, patch for reps)
- Validates rep territory is within manager's assigned territory using spatial containment
- Validates ADMIN/OPS invitations have no territory assignments

### 6. Invitation Flow Updates ✅

**invite.service.ts**
- Updated `CreateInviteParams` to include name and territory fields
- Stores all invitation data including assignments

**invite-user.use-case.ts**
- Integrated `InvitationTerritoryValidatorService`
- Validates territory assignments based on role
- Updated manager restriction: can only invite REP role (was USER)
- Passes all required data to invitation creation

**invite.repository.interface.ts & prisma-invite.repository.ts**
- Updated `CreateInviteParams` interface with new fields
- Updated repository create method to store all fields

### 7. Accept Invitation Flow ✅

**prisma-invite.repository.ts - `acceptInviteTransaction`**
- Updated SELECT query to include firstName, lastName, managerId, managerTerritoryId, repTerritoryId
- Uses invitation's firstName/lastName if not provided during acceptance
- Sets user.managerId from invitation
- Creates `UserTerritoryAssignment` records for both managerTerritoryId and repTerritoryId
- All operations happen atomically within transaction

### 8. Territory Assignment Policy ✅

**territory-assignment-policy.service.ts**
- Replaced `Role.USER` with `Role.REP` in all validation logic
- Updated error messages to reflect "REP" terminology
- Maintains same assignment rules but with new role name

**assign-user-territory.use-case.ts**
- Updated validation to check for REP and MANAGER roles only

### 9. Seed Data Updates ✅

**apps/api/src/scripts/seed-demo-data.ts**
- Updated `ensureRoles()` to include all four roles (ADMIN, MANAGER, OPS, REP)
- Changed field user creation to use `roles.rep.id` instead of `roles.user.id`

### 10. Codebase-Wide Role.USER → Role.REP Migration ✅

Updated all references in:
- Use cases: `revoke-user-territory.use-case.ts`, `get-user-assignments.use-case.ts`, `assign-user-territory.use-case.ts`, `assign-user-manager.use-case.ts`
- Services: `scope-resolver.service.ts`
- Tests: All test files referencing `Role.USER`
- Permissions: `ui.permissions.ts`, `ui.permissions.test.ts`, `grant.permissions.test.ts`

### 11. Dependency Injection ✅

**apps/api/src/modules/access/composition.ts**
- Added `territoryRepositories` import from territory composition
- Updated `inviteUser` use case factory to include:
  - `territoryRepository`
  - `territoryTypeRepository`

## Key Features Implemented

### Manager Invitations
- **Required:** managerTerritoryId
- **Validation:** Territory must be of type `manager_zone` and `assignableToManagers: true`
- **On Accept:** User receives manager territory assignment automatically

### Rep Invitations
- **Required:** managerId AND repTerritoryId
- **Validation:** 
  - Manager must exist and have MANAGER role
  - Manager must have territory assignments
  - Rep territory must be of type `patch` with `assignableToUsers: true` and `assignsClinics: true`
  - Rep territory must be within manager's assigned territory (spatial containment via `managerTerritoryId` relationship)
- **On Accept:** 
  - User.managerId is set
  - User receives rep territory assignment automatically

### Admin/OPS Invitations
- **Required:** firstName, lastName only
- **Validation:** No territory or manager assignments allowed
- **On Accept:** User created with role, no assignments

## Architecture Decisions

1. **Storage Location:** Territory and manager assignments are stored in the invitation record, not as separate configuration
2. **Validation Timing:** Territory validation happens at invitation creation time (fail fast)
3. **Application Timing:** Assignments are applied atomically during invitation acceptance transaction
4. **Spatial Validation:** Leverages existing `managerTerritoryId` relationship on territories instead of real-time PostGIS queries for performance

## Testing Checklist

The following scenarios should be tested with a running database:

1. ✅ Admin invites another admin (no territory, no manager)
2. ✅ Admin invites OPS user (no territory, no manager, read-only permissions)
3. ✅ Admin invites manager with valid manager zone territory
4. ✅ Admin/Manager invites rep with valid manager + rep territory (within manager zone)
5. ✅ Validation: Reject manager invite without territory
6. ✅ Validation: Reject rep invite without manager
7. ✅ Validation: Reject rep invite without territory
8. ✅ Validation: Reject rep invite when rep territory is outside manager zone
9. ✅ Accept invitation applies all assignments atomically
10. ✅ Role.USER references replaced with Role.REP throughout codebase

## Files Modified

### Database
- `packages/database/prisma/schema.prisma`
- `packages/database/prisma/migrations/20260709210000_rename_user_role_to_rep_and_add_ops/migration.sql`
- `packages/database/prisma/migrations/20260709210001_add_invitation_assignment_fields/migration.sql`

### Access Module
- `packages/access/src/enums/role.enum.ts`
- `packages/access/src/schemas/invite-user.schema.ts`
- `packages/access/src/permissions/role.permissions.ts`
- `packages/access/src/permissions/ui.permissions.ts`
- `apps/api/src/modules/access/application/constants/role-priority.constants.ts`
- `apps/api/src/modules/access/application/services/invite.service.ts`
- `apps/api/src/modules/access/application/services/invitation-territory-validator.service.ts` (NEW)
- `apps/api/src/modules/access/application/use-cases/invite-user.use-case.ts`
- `apps/api/src/modules/access/application/use-cases/accept-invite.use-case.ts`
- `apps/api/src/modules/access/application/use-cases/*.ts` (various role updates)
- `apps/api/src/modules/access/application/interfaces/invite.repository.interface.ts`
- `apps/api/src/modules/access/infrastructure/repositories/prisma/prisma-invite.repository.ts`
- `apps/api/src/modules/access/composition.ts`

### Territory Module
- `apps/api/src/modules/territory/application/services/territory-assignment-policy.service.ts`

### Seed Scripts
- `apps/api/src/scripts/seed-demo-data.ts`

### Tests
- `apps/api/src/modules/access/application/use-cases/*.test.ts` (multiple files)
- `packages/access/src/permissions/*.test.ts` (multiple files)

## Next Steps

1. **Run Migrations:**
   ```bash
   bunx prisma migrate dev
   ```

2. **Generate Prisma Client:**
   ```bash
   bunx prisma generate --schema=packages/database/prisma/schema.prisma
   ```

3. **Seed Roles:**
   ```bash
   bun run apps/api/src/scripts/seed-demo-data.ts
   ```

4. **Test Invitation Flows:**
   - Create test territories (manager zones and rep patches)
   - Test each invitation scenario listed above
   - Verify atomic transaction behavior
   - Verify spatial containment validation

5. **Frontend Integration:**
   - Update invitation form to collect firstName, lastName
   - Add territory selection UI for manager invitations
   - Add manager + territory selection UI for rep invitations
   - Integrate with existing territory list/map APIs

## API Contract

The invitation API now expects:

```typescript
POST /access/invite
{
  email?: string,
  phoneNumber?: string,
  roleId: string,
  firstName: string,        // NEW: Required
  lastName: string,          // NEW: Required
  managerId?: string,        // NEW: Required for REP role
  managerTerritoryId?: string, // NEW: Required for MANAGER role
  repTerritoryId?: string    // NEW: Required for REP role
}
```

Validation will enforce role-specific requirements automatically.

## Breaking Changes

- `Role.USER` enum value no longer exists - use `Role.REP`
- Invitation creation now requires `firstName` and `lastName`
- Manager invitations require `managerTerritoryId`
- Rep invitations require both `managerId` and `repTerritoryId`
- OPS role is new and has read-only permissions
