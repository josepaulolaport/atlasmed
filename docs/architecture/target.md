# Target Architecture

## Overview

Atlasmed should continue as a modular monolith while the product matures. The backend should keep explicit domain boundaries, OpenAPI-first contracts, strong access control, and event-driven side effects for notifications, audit enrichment, analytics, integrations, and AI reminders.

## Target Backend Stack

- TypeScript.
- Bun runtime.
- ElysiaJS.
- PostgreSQL.
- Redis.
- BullMQ or equivalent queue layer.
- Drizzle ORM, with repository boundaries insulating domain logic from persistence details.
- OpenAPI-first API design.


## Target Mobile Stack

- React Native with Expo as the preferred starting point.
- Native iOS/Android support through Expo config plugins or bare React Native only if future requirements demand it.

## Target Domains

- Identity and tenancy.
- Access, RBAC, grants, MFA, SSO, and audit.
- Healthcare CRM.
- Territory management.
- Visits and activities.
- Tasks, reminders, and workflow automation.
- Notifications.
- Analytics and reporting.
- AI assistant and AI governance.
- Integrations and data ingestion.
- Admin operations and monitoring.

## Event-Driven Patterns

Use domain events for cross-domain side effects. Examples:

- User invited -> send email/WhatsApp notification.
- Visit completed -> update activity metrics and schedule follow-up suggestion.
- External data import completed (when product reintroduces an ingest path) -> create reviewable suggestions and audit event.
- AI action proposed -> create approval/audit record.
- Task due soon -> enqueue notification.

Core domain writes should remain transactional in the owning domain. Events should not replace required permission checks or audit writes.
