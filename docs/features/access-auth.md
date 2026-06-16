# Feature: Access, Auth, and User Management

## Current State

The access/auth area is mature relative to the rest of the platform. It includes authentication, refresh-token sessions, invitation-based registration, password reset, verification, 2FA, RBAC, instance-level grants, user assignments, audit logging, rate limiting, and security hardening.

## Existing User Roles

- `ADMIN`
- `MANAGER`
- `USER`

## Target Role Expansion

The product vision requires at least:

- `ADMIN`
- `MANAGER`
- `USER`
- `DOCTOR`
- `CLINIC`

Role expansion must be designed together with tenancy and external-facing clinic/doctor portal access.

## Known Follow-Ups

- Finish authorization scope enforcement before exposing sensitive clinical/healthcare relationship data.
- Align grant `conditions` semantics between API, CASL helpers, and UI.
- Expand audit events for 2FA failure reasons and permission changes.
- Add SSO/OIDC support for Google, Microsoft Entra ID, and Okta readiness.
- Add 2FA recovery codes and admin reset workflow.
