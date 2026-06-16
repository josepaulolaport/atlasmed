# Spec 0001: Multi-Tenancy Tasks

- [ ] 1. Model organization and membership data.
  - Add Prisma models and migration.
  - Define organization-owned versus global records.
  - Requirements: 1, 2, 4, 6.

- [ ] 2. Add organization context resolution to access/session flows.
  - Include active organization context in auth context.
  - Handle single-organization and multi-organization users.
  - Requirements: 2, 7.

- [ ] 3. Scope invitations and user management to organizations.
  - Associate invitations with organization context.
  - Restrict user lists and role changes to organization scope.
  - Requirements: 4, 5.

- [ ] 4. Enforce tenant filters in clinic, doctor, and registry modules.
  - Add organization-aware repository filters.
  - Add cross-tenant denial tests.
  - Requirements: 3, 8.

- [ ] 5. Add organization context to audit logs.
  - Record organization ID where applicable.
  - Add audit tests for tenant-scoped events.
  - Requirements: 6.
