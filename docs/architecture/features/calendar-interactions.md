# Feature: Calendar and Commercial Interactions

## Current State

AtlasMed delivers a calendar and commercial interaction domain across the Drizzle schema, Bun/Elysia API, CASL access package, BullMQ jobs, and the Flutter mobile app.

The feature supports personal calendar blocks and scheduled facility interactions. Interactions may be in person or remote; a commercial contact is not assumed to be a physical visit.

The web app does not expose this feature. The delivered client is the Flutter app while [ADR 0002](../adr/0002-mobile-stack.md) remains Proposed.

## Domain Boundaries

`calendar` owns time, recurrence, availability, occurrence identity, rescheduling, cancellation, and overlap detection.

`interactions` owns the commercial lifecycle for each interaction occurrence, including actual start/end times, corrections, linked orders, compatibility visits, and transition history.

A calendar event is one of:

- `INTERACTION` — scheduled commercial contact with a facility.
- `PERSONAL_BLOCK` — private time that occupies the owner's calendar without a facility or interaction record.

An interaction has modality `IN_PERSON` or `REMOTE`. New contracts use calendar, interaction, occurrence, contact, and attendance terminology rather than treating every contact as a visit.

## Persistence Model

The schema is defined in `packages/database/src/schema/public/calendar.ts` and related order/visit schema files.

| Table | Responsibility |
|---|---|
| `calendar` | Event or recurring series, owner, type, title, local anchor, IANA timezone, duration, first UTC interval, recurrence bounds, cancellation data, and optimistic version. |
| `calendar_occurrence_overrides` | Per-occurrence reschedule or cancellation keyed by `(calendar_id, recurrence_key)`, with its own optimistic version. |
| `interactions` | Commercial state for one occurrence, keyed uniquely by `(calendar_id, recurrence_key)`, with facility, agent, modality, timestamps, correction data, optional compatibility `visit_id`, and version. |
| `interaction_events` | Append-only transition history with actor, previous/new status, reason, safe metadata, and timestamp. |
| `calendar_command_receipts` | Idempotency receipts unique by `(owner_user_id, command_key)`, storing the command result for replay. |

`orders.interaction_id` is nullable and indexed. A single interaction may have zero or many linked orders, while each order keeps its own lifecycle and seller/facility/vertical rules.

Business-history foreign keys use restrictive deletion. Calendar and interaction rows are not transient UI state.

## Recurrence and Occurrence Identity

Supported recurrence values are `NONE`, `DAILY`, `WEEKLY`, `MONTHLY`, and `YEARLY`. A recurring series may end by local date, by occurrence count, or remain open-ended.

The series stores a local date/time anchor and IANA timezone. Expansion preserves local wall-clock time and converts each occurrence to UTC, including timezone offset changes.

Monthly and yearly recurrence uses the fixed last-day rule: if the anchor day does not exist in a target month or year, that occurrence uses the month's last valid day.

Examples:

- Monthly from 31 January produces 28/29 February, 31 March, and 30 April.
- Yearly from 29 February produces 28 February in non-leap years.

The rule always returns to the original anchor day when that day exists again. February clamping does not change a series anchored on the 31st into a series anchored on the 28th.

`recurrence_key` is the original local occurrence plus timezone, such as `2026-08-03T09:00[America/Sao_Paulo]`. Rescheduling changes effective UTC times but preserves this identity.

Occurrences are expanded for a requested range. Interaction rows for recurring occurrences are materialized idempotently as those occurrences are read, using the series' facility, agent, and modality snapshot.

## Per-Occurrence Interaction Lifecycle

Each recurring occurrence has an independent interaction row and version. Starting, completing, missing, rescheduling, or cancelling one occurrence does not change sibling occurrences.

The delivered transition lifecycle is:

```text
SCHEDULED -> IN_PROGRESS -> COMPLETED
    |
    +-> NOT_COMPLETED -> COMPLETED
```

The schema also defines `CANCELLED` plus cancellation metadata. In the delivered API, cancellation is commanded through the calendar series/occurrence endpoints and removes the effective occurrence from agenda reads.

Current behavior:

- Opening the attendance workspace does not start the interaction.
- The owner may start a `SCHEDULED` interaction before its scheduled time.
- Only `IN_PROGRESS` or `NOT_COMPLETED` may transition to `COMPLETED`.
- Correcting `NOT_COMPLETED` to `COMPLETED` requires a non-empty correction reason.
- `IN_PROGRESS` is never auto-marked missed after the scheduled end.
- Calendar occurrence/series cancellation controls effective schedule visibility and requires a reason.
- Rescheduling or cancelling an interaction occurrence is allowed only while it is scheduled.

Start, completion, and overdue transitions append `interaction_events`. Completion locks the interaction row, validates the expected version, and creates the compatibility visit in the same transaction.

## Availability, Overlap, and Concurrency

Interactions and personal blocks compete for the same owner calendar. Intervals are half-open: `[startsAt, endsAt)`, so one event may begin exactly when another ends.

Creation, series edits, and occurrence edits reject the entire command when any effective occurrence overlaps another active event or override. Cancelled series and cancelled occurrences do not occupy time.

The API is authoritative. Mobile availability checks improve feedback but do not replace server conflict validation.

Calendar mutations run in a database transaction with `pg_advisory_xact_lock(hashtext(owner_user_id))`. This serializes writes for one owner through the delivered repository and closes the normal API-level overlap race.

A database exclusion constraint is not yet present. The pending migration must add the PostgreSQL overlap-exclusion backstop, or an equivalent database-enforced occurrence-range design, before deployment.

## Authorization and Scope

CASL subjects `CALENDAR` and `INTERACTION` are part of `@atlasmed/access`.

| Role | Calendar and interaction capability |
|---|---|
| `ADMIN` | Type-level `manage`; use-cases still apply owner and resource scope rules. |
| `REP` | Create, read, update, and delete own calendar; read and transition own interactions. |
| `MANAGER` | Read calendars/interactions for managed users in scope; no lifecycle or calendar mutations. |
| `OPS` | No Calendar/Interaction permission. |

Calendar mutations derive the owner from the authenticated actor. They do not trust a client-supplied owner.

Manager reads require the selected owner to be in `scope.managedUserIds`, unless access is global. Interaction reads also require the facility to be in resource scope.

Personal blocks shown in a manager view are redacted to `Indisponível`; their private title is not exposed.

Interaction mutation requires both `interactions.agent_user_id` and `calendar.owner_user_id` to match the authenticated actor. Managers remain read-only even when they can inspect the record.

## Notes and Orders

The attendance workspace reuses facility notes rather than creating an interaction-owned note table.

`GET /facilities/:id/notes` returns the actor's notes by default. An authorized manager may pass `ownerUserId` to read a managed representative's notes for an in-scope facility.

`POST /facilities/:id/notes` always creates the note for the authenticated actor. Managers cannot write notes on behalf of representatives.

Order creation accepts optional `interactionId`. When present, the API verifies:

- the actor can read and own the interaction;
- the order facility matches the interaction facility;
- the interaction is `SCHEDULED` or `IN_PROGRESS`;
- the existing order vertical, product, and facility scope rules still pass.

The interaction detail DTO includes linked orders. Order and interaction lifecycles remain independent; an order failure does not complete an interaction.

## API Surface

All routes use authenticated Elysia handlers, CASL `requirePermission`, scope-aware use-cases, TypeBox request contracts, Zod domain parsing, and explicit DTOs.

### Calendar

- `GET /calendar?from=&to=&ownerUserId=` — expanded chronological occurrences for a range of at most 366 days.
- `GET /calendar/availability?from=&to=&ownerUserId=` — occupied intervals for the same scoped view.
- `POST /calendar` — create a one-off or recurring interaction/personal block.
- `PATCH /calendar/:id` — edit a one-off event or recurring series.
- `PATCH /calendar/:id/occurrences/:recurrenceKey` — reschedule one occurrence.
- `DELETE /calendar/:id` — cancel a one-off event or series with a reason.
- `DELETE /calendar/:id/occurrences/:recurrenceKey` — cancel one occurrence with a reason.

Calendar mutation commands require `Idempotency-Key`. Updates and cancellations also require `expectedVersion`.

### Interactions

- `GET /interactions/:id` — attendance context, facility, agent, occurrence, state, permissions, and linked orders.
- `POST /interactions/:id/start` — transition from `SCHEDULED` to `IN_PROGRESS`.
- `POST /interactions/:id/complete` — complete an in-progress interaction or correct a missed interaction with justification.

Start and completion require `Idempotency-Key` and `expectedVersion`.

### Related Existing Endpoints

- `GET /orders?interactionId=` — list orders linked to an interaction.
- `POST /orders` with `interactionId` — create an order in interaction context.
- `GET /facilities/:id/notes?ownerUserId=` — read own or authorized managed-user facility notes.
- `POST /facilities/:id/notes` — add an authenticated actor's facility note.

## Mobile Flows

The Flutter feature lives under `apps/mobile/lib/features/agenda/` and is wired into app routing and the shell.

The Agenda screen provides:

- a week-based chronological list grouped by day;
- previous, next, and current-period controls;
- local title/facility search;
- event creation for authorized users;
- a managed-representative selector for managers;
- read-only manager views with hidden mutation controls.

The editor supports interaction or personal block, facility selection for interactions, modality, date/time, duration in 30-minute increments, recurrence, series bounds, and series/occurrence editing.

The facility detail quick action schedules an interaction with the facility prefilled. It no longer treats the action as immediate physical visit completion.

The attendance route `/agenda/interactions/:id` shows facility, agent, modality, scheduled interval, status, linked orders, facility notes, and permitted actions.

Starting is explicit. “Novo pedido” carries `interactionId` and facility context through the cart and returns to/refetches the attendance flow after success.

The owner can add a facility note, start, complete, reschedule, or cancel when the current state permits. A manager sees the representative's scoped notes and interaction data without mutation controls.

Mobile commands send idempotency keys and expected versions. Failed requests keep the UI from assuming success; version and overlap conflicts are surfaced for reload/retry.

## Overdue Processing

The API initializes a BullMQ queue and worker named `interaction-overdue`. A repeatable job runs every minute with worker concurrency one.

Each run processes batches of up to 100 until no full batch remains. It changes only `SCHEDULED` interactions whose effective occurrence end is before the job time.

Cancelled overrides are skipped. Each successful transition becomes `NOT_COMPLETED`, increments the interaction version, and appends an `interaction_events` row with `source: overdue-job`.

## Visits Compatibility

`visits` remains a compatibility ledger for existing weekly summaries and consumers. It is not the business term or source model for new scheduled contacts.

Completing an interaction creates exactly one visit when `interactions.visit_id` is empty, then stores that ID under a unique constraint. The visit time is actual start, or completion time when no start exists.

Completion and visit creation occur in one locked transaction. Replayed completion commands return the completed interaction without inserting another visit.

Legacy visit APIs remain available during migration. New calendar and mobile flows create interactions, not immediate visit records.

## Idempotency and Optimistic Concurrency

Calendar commands use `calendar_command_receipts`. Repeating the same key for the same owner returns the stored result rather than executing the mutation again.

Interaction start/completion record command name, idempotency key, and result version in `interaction_events`. A retry finds that event and returns the current detail.

Calendar series and overrides, plus interactions, carry integer versions. Commands compare `expectedVersion`; stale versions return conflict errors instead of silently overwriting newer state.

Database uniqueness on occurrence identity, visit linkage, and command receipts provides additional duplicate protection.

## Migration and Deployment Gate

Per owner instruction, database migrations were intentionally not generated in this branch. The Drizzle schema changes describe the delivered model, but they are not deployable until migration artifacts exist.

Before this feature branch is merged or deployed, the owner must generate the migration from the final schema, review the SQL and metadata, include the pending overlap exclusion, and apply it with `bun run db:migrate`.

The migration workflow must follow the repository safety rules: no bare `drizzle-kit push`, no `push --force`, and no push against a populated CRM database. Run `bunx drizzle-kit check` after generation and branch integration.
