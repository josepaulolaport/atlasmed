# Completed Implementation Inventory

This document lists implementation work already present in the repository at the time of analysis. These items should be treated as completed baseline work for planning and Linear tracking.

## Platform Foundation

- [x] Monorepo workspace with `apps/*` and `packages/*`.
- [x] Bun-based development scripts and Turbo task orchestration.
- [x] Shared TypeScript base configuration.
- [x] Docker Compose setup for PostgreSQL, Redis, and observability dependencies.
- [x] CI workflows for backend, web, and mobile.

## Backend API Foundation

- [x] Bun and ElysiaJS backend application.
- [x] Versioned API routing under `/api/v1`.
- [x] OpenAPI and Swagger documentation configuration.
- [x] Global CORS configuration.
- [x] Security headers middleware.
- [x] Global typed error handler.
- [x] Environment validation and configuration module.
- [x] Health endpoints for liveness, readiness, detailed health, and metrics.

## Database and Persistence

- [x] PostgreSQL persistence through Prisma.
- [x] Prisma schema and migrations for access/auth models.
- [x] Prisma schema and migrations for clinic, doctor, and registry ingestion models.
- [x] Generated Prisma client package.
- [x] Database seed scripts for local/test setup.
- [x] Test database helpers and integration database utilities.

## Access, Auth, and Security

- [x] Login with email, username, or phone identifier.
- [x] JWT access-token issuing.
- [x] Refresh-token session rotation.
- [x] Refresh-token reuse detection with persisted previous token hash.
- [x] Logout and session revocation.
- [x] Invitation-based registration.
- [x] Password reset request and completion.
- [x] Password hashing with Argon2.
- [x] Password history support.
- [x] Email verification.
- [x] Phone verification.
- [x] Email change verification flow.
- [x] Phone change verification flow.
- [x] Two-factor authentication setup, confirmation, disable, and login verification routes.
- [x] Pending 2FA login storage and verification service.
- [x] User profile read and update.
- [x] User activation, deactivation, suspension, and unsuspension workflows.
- [x] Session/device tracking with browser, OS, device type, IP, and suspicious activity fields.
- [x] Session security service for anomaly detection.
- [x] Rate limiting for authentication-sensitive flows.
- [x] Trusted proxy/client IP utility work.
- [x] Auth cache and session cache using Redis.

## Roles, Permissions, and Scope

- [x] Role model and role routes.
- [x] Baseline roles: `ADMIN`, `MANAGER`, `USER`.
- [x] Route-level permission checks.
- [x] Instance-level permission grants.
- [x] Permission grant/revoke API routes.
- [x] Permission cache and invalidation behavior.
- [x] User territory assignment model.
- [x] User assignment API route and tests.
- [x] Scope resolver service.
- [x] Scope repository and cache.
- [x] Shared access contracts, subjects, schemas, and permission helpers in `packages/access`.

## Audit and Compliance Foundation

- [x] Audit log model.
- [x] Audit log service.
- [x] Audit event types for user, session, verification, permission, registry, doctor-clinic, and data-access events.
- [x] Audit severity levels.
- [x] SIEM export helper placeholder/foundation.
- [x] Cleanup jobs for audit retention and expired security records.

## Notifications and External Messaging

- [x] BullMQ queue client.
- [x] Notification queue foundation.
- [x] Cleanup job scheduling.
- [x] Resend email client and service.
- [x] React Email templates for invites and password reset.
- [x] Twilio client and WhatsApp/SMS messaging service.
- [x] Invite and password reset messaging templates.
- [x] Graceful fallback when live messaging credentials are missing.

## Observability and Operations

- [x] Structured Pino logging.
- [x] Request ID generation and propagation.
- [x] Request duration logging.
- [x] OpenTelemetry plugin and shared observability package.
- [x] Prometheus metrics service and endpoint.
- [x] QuestDB logging integration foundation.
- [x] QuestDB Docker Compose and setup documentation.
- [x] Error code documentation.
- [x] Backend phase implementation docs for error handling, observability, versioning, and API docs.

## Clinic, Doctor, and Registry Domains

- [x] Clinic model with registry provenance and soft-delete fields.
- [x] Doctor model with registry provenance and soft-delete fields.
- [x] Doctor-clinic association model.
- [x] Clinic application use cases and repository interface.
- [x] Clinic Prisma repository.
- [x] Clinic API routes.
- [x] Doctor application use cases and repository interface.
- [x] Doctor Prisma repository.
- [x] Doctor API routes.
- [x] Doctor-clinic association use cases and repository.
- [x] Registry ingestion run model.
- [x] Registry ingestion suggestion model.
- [x] Registry ingestion service and use cases.
- [x] Mock registry source adapter.
- [x] Registry ingestion API routes.
- [x] Registry suggestion approval/rejection workflows.
- [x] Registry ingestion tests and HTTP/database integration test coverage.

## Web App Foundation

- [x] Next.js 16 web application.
- [x] Tailwind CSS 4 setup.
- [x] Radix UI component usage.
- [x] Shared UI primitives for button, input, select, dialog, table, dropdown, avatar, badge, card, label, toast, and toaster.
- [x] Axios API client with error handling.
- [x] Auth routes and protected route handling.
- [x] Auth context and token refresh flow.
- [x] Permission helper utilities.
- [x] Zod validators.

## Web App Screens and Flows

- [x] Landing page.
- [x] Login page.
- [x] 2FA login page.
- [x] Register page.
- [x] Forgot password page.
- [x] Reset password page.
- [x] Dashboard page.
- [x] Profile page.
- [x] Security page.
- [x] Change email page.
- [x] Change phone page.
- [x] Verify email page.
- [x] Verify phone page.
- [x] Sessions page.
- [x] Health dashboard page.
- [x] Users list page.
- [x] User invite page.
- [x] Invitations page.
- [x] User role-change dialog.
- [x] User permission-management dialog.
- [x] User assignment-management dialog.
- [x] Clinics page.
- [x] Clinic detail page.
- [x] Doctors page.
- [x] Registry suggestions page.

## Mobile

- [x] Flutter starter app exists under `apps/mobile`.
- [x] Mobile CI workflow exists.
- [x] Mobile stack decision documented as proposed because the target direction is React Native/Expo.

## Documentation and Project Notes

- [x] Project summary documentation.
- [x] Setup instructions and setup completion notes.
- [x] Frontend/backend sync notes.
- [x] API endpoint reference.
- [x] Email/SMS status report.
- [x] Access/auth hardening plan.
- [x] Access/auth remaining work checklist.
- [x] Migration guide and fix summaries.
