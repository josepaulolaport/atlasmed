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

## Target Web Stack

- Next.js.
- React.
- TypeScript.
- Tailwind CSS.
- Component-based design system.
- Dashboard and analytics-first UX.

## Target Mobile Stack

- React Native with Expo as the preferred starting point.
- Native iOS/Android support through Expo config plugins or bare React Native only if future requirements demand it.

## Target Domains

- Identity and tenancy.
- Access, RBAC, grants, MFA, SSO, and audit.
- Healthcare CRM.
- Territory management.
- Calendar, interactions, activities, and follow-ups.
- Tasks, reminders, and workflow automation.
- Notifications.
- Analytics and reporting.
- AI assistant and AI governance.
- Integrations and data ingestion.
- Admin operations and monitoring.

The delivered Calendar/Interactions domain is the base for activity history. The target model should treat physical visits as one interaction modality, move metrics from the compatibility `visits` ledger to completed interactions, and retire the ledger only after data and consumer migration.

Calendar concurrency should keep owner-scoped transactional locking and add database-enforced overlap exclusion through the required reviewed migration. See [Calendar and Commercial Interactions](features/calendar-interactions.md).

## Event-Driven Patterns

Use domain events for cross-domain side effects. Examples:

- User invited -> send email/WhatsApp notification.
- Interaction completed -> update activity metrics and schedule a follow-up suggestion; physical visits are represented as in-person interactions.
- Registry ingestion completed -> create suggestions and audit event.
- AI action proposed -> create approval/audit record.
- Task due soon -> enqueue notification.

Core domain writes should remain transactional in the owning domain. Events should not replace required permission checks or audit writes.
