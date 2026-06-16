# Spec 0001: Multi-Tenancy Design

## Overview

Introduce an explicit organization/tenant model and propagate organization context through users, invitations, scoped resources, audit logs, and future AI/tool access.

## Architecture

Add an identity and tenancy layer inside the access domain before broadening healthcare data access. This keeps authentication, user membership, role assignment, and tenant resolution close together.

## Data Model Direction

Add models such as:

- `Organization`.
- `OrganizationMembership` or equivalent if users can belong to multiple organizations.
- Organization-scoped invitations.
- Organization-scoped audit events.

Healthcare records such as clinics, doctors, associations, visits, tasks, and territories should include tenant visibility rules. Public registry source identity should be separated from customer-owned CRM state where needed.

## API Direction

- Add organization context to auth/session responses.
- Add endpoints for organization selection if users can belong to multiple tenants.
- Add admin endpoints for organization management.
- Update list/detail endpoints to enforce organization filters.

## Error Handling

- Return 403 for authenticated users without access to an organization-scoped resource.
- Return 404 where revealing resource existence would leak cross-tenant data.
- Audit denied access attempts for sensitive healthcare records.

## Testing Strategy

- Unit tests for organization context resolution.
- Integration tests for cross-tenant denial on users, clinics, doctors, registry suggestions, and future tasks.
- Regression tests for invitations and session refresh preserving tenant context.
