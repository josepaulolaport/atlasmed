# Calendar and Interactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the mobile agenda, commercial interaction lifecycle, manager read-only view, linked orders, and compatibility with completed visits.

**Architecture:** `calendar` owns time, recurrence, occurrences, and conflicts; `interactions` owns commercial state for calendar occurrences. The API expands simple recurring rules by range, persists occurrence overrides and lifecycle events, and keeps `visits` as a compatibility ledger for completed interactions. Flutter adds an Agenda shell branch plus focused scheduling and attendance flows.

**Tech Stack:** Bun, TypeScript, Elysia, Zod, Drizzle ORM, PostgreSQL, CASL, Flutter, Dart, Riverpod, go_router.

**Migration constraint:** Modify Drizzle schemas only. Do not create, edit, apply, or validate generated files under `packages/database/drizzle/`. The human owner will generate migrations before merge.

---

## File map

### Database and access

- Create `packages/database/src/schema/public/calendar.ts`: enums, calendar events, occurrence overrides, interactions, and interaction lifecycle events.
- Modify `packages/database/src/schema/public/orders.ts`: optional `interactionId` FK and relations.
- Modify `packages/database/src/schema/public/index.ts`: exports.
- Modify `packages/access/src/subjects/subjects.ts`: `CALENDAR` and `INTERACTION` subjects.
- Modify `packages/access/src/permissions/role.permissions.ts`: owner mutation and manager read capabilities at type level.

### API

- Create `apps/api/src/modules/calendar/`: recurrence service, repositories, use-cases, routes, composition, and tests.
- Create `apps/api/src/modules/interactions/`: lifecycle, order linkage, notes context, routes, composition, and tests.
- Modify `apps/api/src/modules/orders/`: accept and validate `interactionId` while preserving existing create-order contracts.
- Modify `apps/api/src/modules/facility/`: manager read-only notes query by note owner.
- Modify `apps/api/src/modules/visits/`: use interaction completion as the future source while preserving current endpoints.
- Modify `apps/api/src/app/app.ts`: mount calendar and interactions modules.
- Modify `apps/api/src/test-utils/route-security.manifest.ts`: record route security.
- Modify `apps/api/src/infrastructure/audit/event-type-map.ts`: calendar/interaction audit mappings.
- Modify `apps/api/src/infrastructure/jobs/cleanup.jobs.ts` or add a focused scheduler service: periodic not-completed transition.

### Mobile

- Create `apps/mobile/lib/features/agenda/data/`: DTOs and HTTP repository.
- Create `apps/mobile/lib/features/agenda/presentation/providers/`: agenda, editor, and attendance state.
- Create `apps/mobile/lib/features/agenda/presentation/screens/agenda_screen.dart`: chronological agenda and manager selector.
- Create `apps/mobile/lib/features/agenda/presentation/screens/calendar_editor_screen.dart`: interaction/block editor.
- Create `apps/mobile/lib/features/agenda/presentation/screens/interaction_screen.dart`: attendance workspace.
- Create focused widgets under `apps/mobile/lib/features/agenda/presentation/widgets/`.
- Modify `apps/mobile/lib/app.dart` and `apps/mobile/lib/shared/widgets/app_shell.dart`: agenda branch and root flows.
- Modify clinic detail quick actions to open the prefilled editor.
- Modify order cart/repository/checkout flow to retain and submit `interactionId` and return to attendance.

---

### Task 1: Define Drizzle calendar and interaction schemas

**Files:**
- Create: `packages/database/src/schema/public/calendar.ts`
- Modify: `packages/database/src/schema/public/orders.ts`
- Modify: `packages/database/src/schema/public/index.ts`
- Test: `packages/database/src/schema/public/calendar.test.ts`

- [ ] **Step 1: Write schema invariant tests**

Create tests that import the new tables and assert exported enum values and inferred insert types support:

```ts
const recurringMonthly = {
  ownerUserId: "user-1",
  kind: "INTERACTION" as const,
  title: "Atendimento",
  anchorLocalDate: "2026-01-31",
  anchorLocalTime: "09:00",
  timeZone: "America/Sao_Paulo",
  durationMinutes: 60,
  recurrence: "MONTHLY" as const,
};
```

Also assert `orders.$inferInsert` accepts an optional `interactionId`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `cd packages/database && bun test src/schema/public/calendar.test.ts`
Expected: FAIL because the calendar exports do not exist.

- [ ] **Step 3: Implement the schema**

Define:

```ts
calendarEventKindEnum: INTERACTION | PERSONAL_BLOCK
calendarRecurrenceEnum: NONE | DAILY | WEEKLY | MONTHLY | YEARLY
calendarOccurrenceStatusEnum: ACTIVE | CANCELLED
interactionModalityEnum: IN_PERSON | REMOTE
interactionStatusEnum: SCHEDULED | IN_PROGRESS | COMPLETED | NOT_COMPLETED | CANCELLED
```

Add tables:

```ts
calendar
calendar_occurrence_overrides
interactions
interaction_events
```

Use `timestamp(..., { withTimezone: true })` for instants, `date`/`time` for recurrence anchors, positive duration checks, unique `(calendar_id, recurrence_key)` occurrence identity, owner/range indexes, and `onDelete: "restrict"` for business history. Add nullable `orders.interactionId` with an index and relation. Export all tables and types from `public/index.ts`.

Do not touch `packages/database/drizzle/`.

- [ ] **Step 4: Re-run database tests and typecheck**

Run:

```bash
cd packages/database
bun test src/schema/public/calendar.test.ts
bunx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/database/src/schema/public/calendar.ts packages/database/src/schema/public/calendar.test.ts packages/database/src/schema/public/orders.ts packages/database/src/schema/public/index.ts
git commit -m "feat(database): model calendar and interactions"
```

### Task 2: Add Calendar and Interaction authorization subjects

**Files:**
- Modify: `packages/access/src/subjects/subjects.ts`
- Modify: `packages/access/src/permissions/role.permissions.ts`
- Test: `packages/access/src/permissions/role.permissions.test.ts`

- [ ] **Step 1: Write failing role tests**

Assert:

```ts
ADMIN: manage CALENDAR and INTERACTION
MANAGER: read CALENDAR and INTERACTION; cannot create/update/delete
REP: create/read/update/delete CALENDAR and INTERACTION
OPS: no CALENDAR or INTERACTION permissions
```

- [ ] **Step 2: Run focused tests**

Run: `cd packages/access && bun test src/permissions/role.permissions.test.ts`
Expected: FAIL for unknown subjects.

- [ ] **Step 3: Add subjects and role abilities**

Add `CALENDAR` and `INTERACTION` to `Subjects`. Keep ownership, managed-user, and facility checks in use-cases; CASL remains type-level.

- [ ] **Step 4: Re-run access tests and typecheck**

Run:

```bash
cd packages/access
bun test
bunx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/access/src/subjects/subjects.ts packages/access/src/permissions/role.permissions.ts packages/access/src/permissions/role.permissions.test.ts
git commit -m "feat(access): authorize calendar and interactions"
```

### Task 3: Implement recurrence expansion and conflict detection

**Files:**
- Create: `apps/api/src/modules/calendar/application/services/recurrence.service.ts`
- Create: `apps/api/src/modules/calendar/application/services/recurrence.service.test.ts`
- Create: `apps/api/src/modules/calendar/application/services/conflict.service.ts`
- Create: `apps/api/src/modules/calendar/application/services/conflict.service.test.ts`

- [ ] **Step 1: Write recurrence RED tests**

Cover:

```text
NONE emits one occurrence
DAILY repeats at the same local time
WEEKLY repeats on anchor weekday
MONTHLY 31 clamps to Feb 28/29 and Apr 30, then returns to 31
YEARLY Feb 29 clamps to Feb 28 in non-leap years
until/count stop expansion
DST conversion preserves local clock time
```

- [ ] **Step 2: Run recurrence tests**

Run: `cd apps/api && bun test src/modules/calendar/application/services/recurrence.service.test.ts`
Expected: FAIL because service is absent.

- [ ] **Step 3: Implement pure recurrence expansion**

Expose a pure function:

```ts
expandCalendarOccurrences(rule, { from, to }): CalendarOccurrence[]
```

Operate in the stored IANA timezone, clamp missing month days, convert each occurrence to UTC, and preserve deterministic `recurrenceKey` from the original local anchor slot.

- [ ] **Step 4: Write and implement conflict tests**

Test semi-open intervals, adjacent events, cancelled overrides, one-off vs recurring, and recurring vs recurring. Expose:

```ts
findCalendarConflicts(candidate, existing, range): CalendarConflict[]
```

Return the first conflicting occurrences for user feedback. Because allowed recurrence rules are limited, compute a finite comparison window from explicit ends or the Gregorian 400-year repeat cycle for two unbounded rules.

- [ ] **Step 5: Run focused tests**

Run:

```bash
cd apps/api
bun test src/modules/calendar/application/services/recurrence.service.test.ts
bun test src/modules/calendar/application/services/conflict.service.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/calendar/application/services
git commit -m "feat(api): expand recurring calendar events"
```

### Task 4: Implement Calendar repositories and use-cases

**Files:**
- Create: `apps/api/src/modules/calendar/application/interfaces/calendar.repository.interface.ts`
- Create: `apps/api/src/modules/calendar/infrastructure/repositories/drizzle/drizzle-calendar.repository.ts`
- Create: `apps/api/src/modules/calendar/application/use-cases/create-calendar-event.use-case.ts`
- Create: `apps/api/src/modules/calendar/application/use-cases/list-calendar.use-case.ts`
- Create: `apps/api/src/modules/calendar/application/use-cases/update-calendar-event.use-case.ts`
- Create: `apps/api/src/modules/calendar/application/use-cases/cancel-calendar-event.use-case.ts`
- Create: corresponding `*.test.ts` files

- [ ] **Step 1: Write use-case RED tests**

Cover own agenda creation, facility scope, manager read of managed user, manager mutation denial, personal block title redaction, recurrence expansion, conflict rejection, single-occurrence override, cancellation reason, idempotency, and optimistic version conflict.

- [ ] **Step 2: Run focused tests**

Run: `cd apps/api && bun test src/modules/calendar/application/use-cases`
Expected: FAIL because use-cases are absent.

- [ ] **Step 3: Define the repository port**

The port must support transactionally:

```ts
findEventsForOwnerAndRange
findEventById
createEventWithInteraction
createOccurrenceOverride
updateEvent
lockOwnerCalendar
findIdempotentCommand
saveIdempotentResult
```

Return domain records, not Drizzle row types.

- [ ] **Step 4: Implement use-cases**

Rules:

- mutation owner is always authenticated actor;
- interaction requires scoped facility and modality;
- manager list requires owner in `managedUserIds` or global access;
- manager personal blocks return title `Indisponível`;
- lock owner, run conflict service, then write;
- cancellation/reagenda only affects `SCHEDULED` interaction occurrences;
- cancel requires nonblank reason;
- DTO dates are ISO strings and include stable occurrence IDs.

- [ ] **Step 5: Implement Drizzle repository**

Use `db.transaction`. Acquire `pg_advisory_xact_lock(hashtext(ownerUserId))` before conflict-sensitive writes until the human-generated exclusion migration exists. Persist calendar and interaction atomically for `INTERACTION` events.

- [ ] **Step 6: Run tests and typecheck**

Run:

```bash
cd apps/api
bun test src/modules/calendar
bun run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/calendar
git commit -m "feat(api): add calendar application layer"
```

### Task 5: Expose Calendar HTTP contracts

**Files:**
- Create: `apps/api/src/modules/calendar/infrastructure/routes/calendar.route.ts`
- Create: `apps/api/src/modules/calendar/composition.ts`
- Create: `apps/api/src/modules/calendar/index.ts`
- Create: `apps/api/src/modules/calendar/calendar-http.integration.test.ts`
- Modify: `apps/api/src/app/app.ts`
- Modify: `apps/api/src/test-utils/route-security.manifest.ts`

- [ ] **Step 1: Write failing HTTP integration tests**

Cover `GET /calendar`, `GET /calendar/availability`, `POST /calendar`, event update/cancel, occurrence update/cancel, unauthenticated, wrong role, manager mutation, scope denial, validation, and conflict `409`.

- [ ] **Step 2: Run the integration test**

Run: `cd apps/api && bun test src/modules/calendar/calendar-http.integration.test.ts`
Expected: FAIL with missing routes.

- [ ] **Step 3: Add TypeBox and Zod contracts**

Use body shape:

```ts
{
  kind: "INTERACTION" | "PERSONAL_BLOCK",
  title: string,
  facilityId?: string,
  modality?: "IN_PERSON" | "REMOTE",
  startsAt: ISO offset datetime,
  timeZone: IANA string,
  durationMinutes: positive integer multiple of 30,
  recurrence: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY",
  recurrenceUntil?: YYYY-MM-DD,
  recurrenceCount?: positive integer
}
```

Reject facility/modality on personal blocks and require both on interactions.

- [ ] **Step 4: Mount routes with security**

Use `auth`, `requirePermission`, `getScope`, `getUserId`, and `getAuthContext`. Add the modules to `app.ts` and security manifest.

- [ ] **Step 5: Run integration, route security, and typecheck**

Run:

```bash
cd apps/api
bun test src/modules/calendar/calendar-http.integration.test.ts
bun test src/test-utils/route-security.test.ts
bun run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/calendar apps/api/src/app/app.ts apps/api/src/test-utils/route-security.manifest.ts
git commit -m "feat(api): expose calendar endpoints"
```

### Task 6: Implement interaction lifecycle and compatibility ledger

**Files:**
- Create: `apps/api/src/modules/interactions/application/interfaces/interaction.repository.interface.ts`
- Create: `apps/api/src/modules/interactions/infrastructure/repositories/drizzle/drizzle-interaction.repository.ts`
- Create: `apps/api/src/modules/interactions/application/use-cases/get-interaction.use-case.ts`
- Create: `apps/api/src/modules/interactions/application/use-cases/start-interaction.use-case.ts`
- Create: `apps/api/src/modules/interactions/application/use-cases/complete-interaction.use-case.ts`
- Create: `apps/api/src/modules/interactions/application/use-cases/mark-overdue-interactions.use-case.ts`
- Create: tests beside use-cases

- [ ] **Step 1: Write lifecycle RED tests**

Cover:

```text
SCHEDULED -> IN_PROGRESS
SCHEDULED cannot complete without starting
IN_PROGRESS -> COMPLETED
expired SCHEDULED -> NOT_COMPLETED
IN_PROGRESS remains in progress after scheduled end
NOT_COMPLETED -> COMPLETED requires correctionReason
complete creates one visits row and is idempotent
manager may read but not transition
wrong owner/scope is forbidden
```

- [ ] **Step 2: Run tests**

Run: `cd apps/api && bun test src/modules/interactions/application/use-cases`
Expected: FAIL because module is absent.

- [ ] **Step 3: Implement lifecycle repository transaction**

Lock interaction row, validate expected version, append `interaction_events`, update status/timestamps, and create the compatibility `visits` row exactly once during completion.

- [ ] **Step 4: Implement use-cases and DTOs**

Use typed transition errors mapped to `409`. `visitedAt` in the compatibility ledger is the actual interaction start time, falling back to completion time only for a corrected legacy-not-completed interaction without `actualStartedAt`.

- [ ] **Step 5: Implement overdue persistence entry point**

Expose `markOverdueInteractions(now, limit)` for a periodic job. Its query changes only `SCHEDULED` rows whose occurrence end is before `now`, appending one event per transition.

- [ ] **Step 6: Run tests and typecheck**

Run:

```bash
cd apps/api
bun test src/modules/interactions
bun run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/interactions
git commit -m "feat(api): manage interaction lifecycle"
```

### Task 7: Expose interaction routes and periodic missed-state processing

**Files:**
- Create: `apps/api/src/modules/interactions/infrastructure/routes/interactions.route.ts`
- Create: `apps/api/src/modules/interactions/composition.ts`
- Create: `apps/api/src/modules/interactions/index.ts`
- Create: `apps/api/src/modules/interactions/interactions-http.integration.test.ts`
- Modify: `apps/api/src/app/app.ts`
- Modify: `apps/api/src/test-utils/route-security.manifest.ts`
- Modify: `apps/api/src/infrastructure/audit/event-type-map.ts`
- Modify: `apps/api/src/infrastructure/jobs/cleanup.jobs.ts`

- [ ] **Step 1: Write HTTP RED tests**

Test get, start, complete, correction reason, manager read-only, duplicate retry, scope denial, and invalid transition.

- [ ] **Step 2: Run integration test**

Run: `cd apps/api && bun test src/modules/interactions/interactions-http.integration.test.ts`
Expected: FAIL with missing routes.

- [ ] **Step 3: Add routes and composition**

Expose `GET /interactions/:id`, `POST /interactions/:id/start`, and `POST /interactions/:id/complete`. Require idempotency key and expected version for commands.

- [ ] **Step 4: Schedule overdue processing**

Register a repeatable job that runs every minute and calls `markOverdueInteractions` in bounded batches. Keep the use-case independent from BullMQ for unit tests.

- [ ] **Step 5: Add audit mapping**

Map calendar create/reschedule/cancel and interaction start/complete/not-completed/correction without logging note content.

- [ ] **Step 6: Run integration and typecheck**

Run:

```bash
cd apps/api
bun test src/modules/interactions/interactions-http.integration.test.ts
bun test src/test-utils/route-security.test.ts
bun run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/interactions apps/api/src/app/app.ts apps/api/src/test-utils/route-security.manifest.ts apps/api/src/infrastructure/audit/event-type-map.ts apps/api/src/infrastructure/jobs/cleanup.jobs.ts
git commit -m "feat(api): expose interaction workflow"
```

### Task 8: Link order creation to interactions

**Files:**
- Modify: `apps/api/src/modules/orders/application/interfaces/order.repository.interface.ts`
- Modify: `apps/api/src/modules/orders/infrastructure/repositories/drizzle/drizzle-order.repository.ts`
- Modify: `apps/api/src/modules/orders/application/use-cases/orders.use-cases.ts`
- Modify: `apps/api/src/modules/orders/infrastructure/routes/orders.route.ts`
- Modify: `apps/api/src/modules/orders/orders-http.integration.test.ts`

- [ ] **Step 1: Write failing order tests**

Assert optional `interactionId` is accepted, returned, and validated so that actor, facility, and interaction match. Existing order creation without `interactionId` must remain unchanged.

- [ ] **Step 2: Run focused tests**

Run: `cd apps/api && bun test src/modules/orders`
Expected: FAIL for missing interaction field.

- [ ] **Step 3: Extend order port, use-case, route, and serializer**

When `interactionId` is present:

- load interaction through an injected interaction-context port;
- require actor ownership and mutable/readable state;
- force facility to the interaction facility;
- persist `sellerId = actor.userId` and `interactionId`;
- include `interactionId` in list/detail DTOs.

- [ ] **Step 4: Run order tests and typecheck**

Run:

```bash
cd apps/api
bun test src/modules/orders
bun run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/orders
git commit -m "feat(orders): link orders to interactions"
```

### Task 9: Add manager read-only access to agent facility notes

**Files:**
- Modify: `apps/api/src/modules/facility/application/use-cases/facility-note.use-cases.ts`
- Modify: `apps/api/src/modules/facility/application/use-cases/facility-note.use-cases.test.ts`
- Modify: `apps/api/src/modules/facility/infrastructure/routes/facilities.route.ts`
- Modify: `apps/api/src/modules/facility/facility-http.integration.test.ts`

- [ ] **Step 1: Write note visibility RED tests**

Cover own notes, manager reading `noteOwnerUserId` in `managedUserIds`, manager denied for unmanaged user, facility scope denial, and manager unable to create a note for another user.

- [ ] **Step 2: Run focused tests**

Run: `cd apps/api && bun test src/modules/facility/application/use-cases/facility-note.use-cases.test.ts`
Expected: FAIL because target note owner is unsupported.

- [ ] **Step 3: Extend list-only contract**

Allow `GET /facilities/:id/notes?ownerUserId=`. Default owner remains authenticated user. If owner differs, require global access or `managedUserIds.includes(ownerUserId)`. Keep POST owner fixed to actor.

- [ ] **Step 4: Run tests and typecheck**

Run:

```bash
cd apps/api
bun test src/modules/facility/application/use-cases/facility-note.use-cases.test.ts
bun test src/modules/facility/facility-http.integration.test.ts
bun run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/facility
git commit -m "feat(api): let managers read scoped agent notes"
```

### Task 10: Build the mobile agenda data layer

**Files:**
- Create: `apps/mobile/lib/features/agenda/data/calendar_models.dart`
- Create: `apps/mobile/lib/features/agenda/data/calendar_repository.dart`
- Create: `apps/mobile/lib/features/agenda/presentation/providers/agenda_provider.dart`
- Create: `apps/mobile/test/features/agenda/data/calendar_models_test.dart`
- Create: `apps/mobile/test/features/agenda/data/calendar_repository_test.dart`

- [ ] **Step 1: Write model and repository RED tests**

Test parsing chronological items, redacted manager blocks, recurrence conflicts, interaction context, request serialization, ISO/local conversion, and pt-BR date labels.

- [ ] **Step 2: Run focused tests**

Run: `cd apps/mobile && flutter test test/features/agenda/data`
Expected: FAIL because files are absent.

- [ ] **Step 3: Implement DTOs and repository**

Provide range list, availability, create/update/cancel event, get/start/complete interaction, and linked-order list. Use the existing session-aware HTTP client and surface typed conflict, permission, validation, and version exceptions.

- [ ] **Step 4: Implement Riverpod providers**

Key agenda state by range and optional owner user. Invalidate own agenda, manager agenda, interaction detail, and linked orders after successful commands.

- [ ] **Step 5: Run tests and analyze focused code**

Run:

```bash
cd apps/mobile
flutter test test/features/agenda/data
flutter analyze lib/features/agenda
```

Expected: PASS/no issues.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/lib/features/agenda/data apps/mobile/lib/features/agenda/presentation/providers apps/mobile/test/features/agenda/data
git commit -m "feat(mobile): add agenda data layer"
```

### Task 11: Add Agenda navigation and chronological screen

**Files:**
- Create: `apps/mobile/lib/features/agenda/presentation/screens/agenda_screen.dart`
- Create: `apps/mobile/lib/features/agenda/presentation/widgets/agenda_day_section.dart`
- Create: `apps/mobile/lib/features/agenda/presentation/widgets/agenda_item.dart`
- Modify: `apps/mobile/lib/app.dart`
- Modify: `apps/mobile/lib/shared/widgets/app_shell.dart`
- Test: `apps/mobile/test/features/agenda/presentation/agenda_screen_test.dart`
- Test: `apps/mobile/test/shared/widgets/app_shell_test.dart`

- [ ] **Step 1: Write widget RED tests**

Assert grouping by local day, chronological ordering, aligned times, pt-BR copy, state text plus icon, manager user selector, read-only manager controls, empty/loading/error states, and agenda drawer branch.

- [ ] **Step 2: Run widget tests**

Run:

```bash
cd apps/mobile
flutter test test/features/agenda/presentation/agenda_screen_test.dart
flutter test test/shared/widgets/app_shell_test.dart
```

Expected: FAIL because screen/branch is absent.

- [ ] **Step 3: Implement Agenda screen**

Follow existing AtlasMed tokens and top bar. Use a flat day-grouped list rather than nested cards. Use the supplied image only for information hierarchy: date heading, event rows, time column, and compact toolbar.

- [ ] **Step 4: Add shell branch and drawer item**

Add `/agenda` as a `StatefulShellBranch`, import `AgendaScreen`, and expose “Agenda” to REP/MANAGER/ADMIN according to mobile capabilities.

- [ ] **Step 5: Run tests and analyze**

Run:

```bash
cd apps/mobile
flutter test test/features/agenda/presentation/agenda_screen_test.dart test/shared/widgets/app_shell_test.dart
flutter analyze lib/features/agenda lib/app.dart lib/shared/widgets/app_shell.dart
```

Expected: PASS/no issues.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/lib/features/agenda/presentation apps/mobile/lib/app.dart apps/mobile/lib/shared/widgets/app_shell.dart apps/mobile/test/features/agenda/presentation apps/mobile/test/shared/widgets/app_shell_test.dart
git commit -m "feat(mobile): add chronological agenda"
```

### Task 12: Build event editor and clinic scheduling entry point

**Files:**
- Create: `apps/mobile/lib/features/agenda/presentation/screens/calendar_editor_screen.dart`
- Create: `apps/mobile/lib/features/agenda/presentation/providers/calendar_editor_provider.dart`
- Create: `apps/mobile/lib/features/agenda/presentation/widgets/recurrence_fields.dart`
- Modify: `apps/mobile/lib/app.dart`
- Modify: `apps/mobile/lib/features/explore/presentation/screens/clinic_detail_screen.dart`
- Test: `apps/mobile/test/features/agenda/presentation/calendar_editor_screen_test.dart`
- Test: relevant clinic detail widget test

- [ ] **Step 1: Write editor RED tests**

Cover interaction/block switch, facility requirement, modality, one-hour default, 30-minute duration increments, unrestricted clock selection, recurrence/end controls, persisted draft on network failure, conflict list, and manager read-only denial.

- [ ] **Step 2: Run focused tests**

Run: `cd apps/mobile && flutter test test/features/agenda/presentation/calendar_editor_screen_test.dart`
Expected: FAIL because editor is absent.

- [ ] **Step 3: Implement editor and routes**

Add `/agenda/new`, `/agenda/:calendarId/edit`, and occurrence edit query parameters on root navigator. Preserve form state in a provider until successful save or explicit discard.

- [ ] **Step 4: Replace clinic quick action**

Rename visible action from “Visita” to “Agendar interação” and push `/agenda/new?facilityId=<id>&kind=INTERACTION`. Remove immediate `createVisit()` from this action while keeping legacy visit repositories for compatibility consumers.

- [ ] **Step 5: Run tests and analyze**

Run:

```bash
cd apps/mobile
flutter test test/features/agenda/presentation/calendar_editor_screen_test.dart test/features/explore/presentation/widgets/clinic_detail_loading_test.dart
flutter analyze lib/features/agenda lib/features/explore/presentation/screens/clinic_detail_screen.dart lib/app.dart
```

Expected: PASS/no issues.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/lib/features/agenda apps/mobile/lib/app.dart apps/mobile/lib/features/explore/presentation/screens/clinic_detail_screen.dart apps/mobile/test/features/agenda apps/mobile/test/features/explore
git commit -m "feat(mobile): schedule interactions from clinics"
```

### Task 13: Build the attendance workspace

**Files:**
- Create: `apps/mobile/lib/features/agenda/presentation/screens/interaction_screen.dart`
- Create: `apps/mobile/lib/features/agenda/presentation/providers/interaction_provider.dart`
- Create: focused attendance widgets
- Modify: `apps/mobile/lib/app.dart`
- Modify: facility notes repository/provider to accept optional note owner for manager reads
- Test: `apps/mobile/test/features/agenda/presentation/interaction_screen_test.dart`

- [ ] **Step 1: Write attendance RED tests**

Cover opening without state change, start button, early start, linked orders, own notes/create note, manager reading agent notes without mutation controls, completion, cancellation/reagenda visibility, not-completed correction dialog requiring justification, and retry errors.

- [ ] **Step 2: Run focused test**

Run: `cd apps/mobile && flutter test test/features/agenda/presentation/interaction_screen_test.dart`
Expected: FAIL because workspace is absent.

- [ ] **Step 3: Implement interaction workspace**

Add root route `/agenda/interactions/:id`. Compose existing facility context patterns, notes repository, linked orders, and explicit lifecycle commands. Do not start on screen open or note/order action.

- [ ] **Step 4: Implement manager note reads**

Pass `ownerUserId` only for manager viewing another agent. Hide note composer and every mutation action for manager mode.

- [ ] **Step 5: Run tests and analyze**

Run:

```bash
cd apps/mobile
flutter test test/features/agenda/presentation/interaction_screen_test.dart
flutter analyze lib/features/agenda lib/features/explore/data/repositories/facility_notes_repository.dart lib/app.dart
```

Expected: PASS/no issues.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/lib/features/agenda apps/mobile/lib/app.dart apps/mobile/lib/features/explore/data/repositories/facility_notes_repository.dart apps/mobile/test/features/agenda
git commit -m "feat(mobile): add interaction workspace"
```

### Task 14: Carry interaction context through order creation

**Files:**
- Modify: `apps/mobile/lib/features/orders/presentation/providers/orders_provider.dart`
- Modify: `apps/mobile/lib/features/orders/data/repositories/orders_repository.dart`
- Modify: `apps/mobile/lib/features/orders/presentation/screens/new_order_products_screen.dart`
- Modify: `apps/mobile/lib/features/orders/presentation/screens/checkout_screen.dart`
- Modify: `apps/mobile/lib/features/orders/presentation/screens/order_success_screen.dart`
- Modify: `apps/mobile/lib/app.dart`
- Test: order provider/repository/screen tests

- [ ] **Step 1: Write order-context RED tests**

Assert `CartState` carries `interactionId`, clinic is preselected and locked for an interaction, create request sends `interactionId`, clearing/finalizing clears context, and success returns to `/agenda/interactions/:id`.

- [ ] **Step 2: Run focused tests**

Run: `cd apps/mobile && flutter test test/features/orders`
Expected: FAIL for missing context.

- [ ] **Step 3: Extend cart and repository**

Add nullable `interactionId`, include it in copy/reset semantics, and serialize it in `createOrder`. Initialize order flow from route extra/query with interaction and clinic context.

- [ ] **Step 4: Return to attendance after success**

When interaction context exists, the success screen action pops/goes to the interaction workspace and invalidates linked orders. Existing standalone order flow remains unchanged.

- [ ] **Step 5: Run tests and analyze**

Run:

```bash
cd apps/mobile
flutter test test/features/orders
flutter analyze lib/features/orders lib/app.dart
```

Expected: PASS/no issues.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/lib/features/orders apps/mobile/lib/app.dart apps/mobile/test/features/orders
git commit -m "feat(mobile): create orders from interactions"
```

### Task 15: Update feature architecture documentation

**Files:**
- Create: `docs/architecture/features/calendar-interactions.md`
- Modify: `docs/architecture/current.md`
- Modify: `docs/architecture/target.md`
- Modify: `docs/architecture/features/clinic-doctor-registry.md`

- [ ] **Step 1: Document delivered concepts**

Record Calendar vs Interaction ownership, recurrence policy, lifecycle, manager scope, order/note relations, compatibility with `visits`, and the explicit pending migration requirement.

- [ ] **Step 2: Remove stale architecture gap**

Update `current.md` so it no longer claims there is no visit/activity domain after implementation. Keep future migration/removal of `visits` explicit.

- [ ] **Step 3: Validate docs**

Run:

```bash
grep -RIn -E '\b(TBD|TODO|FIXME)\b' docs/architecture/features/calendar-interactions.md docs/architecture/current.md docs/architecture/target.md docs/architecture/features/clinic-doctor-registry.md || true
git diff --check
```

Expected: no placeholders or whitespace errors.

- [ ] **Step 4: Commit**

```bash
git add docs/architecture/features/calendar-interactions.md docs/architecture/current.md docs/architecture/target.md docs/architecture/features/clinic-doctor-registry.md
git commit -m "docs: describe calendar and interaction architecture"
```

### Task 16: Full verification without migrations

**Files:**
- Verify all touched files.
- Confirm no files under `packages/database/drizzle/` changed.

- [ ] **Step 1: Format**

Run:

```bash
bunx prettier --write packages/access/src packages/database/src apps/api/src docs/superpowers docs/architecture PRODUCT.md CONTEXT.md
cd apps/mobile && dart format lib test
```

- [ ] **Step 2: Run TypeScript tests and checks**

Run:

```bash
cd packages/access && bun test && bunx tsc --noEmit
cd ../database && bun test && bunx tsc --noEmit
cd ../../apps/api && bun test && bun run lint && bun run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run Flutter tests and analysis**

Run:

```bash
cd apps/mobile
flutter test
flutter analyze
```

Expected: PASS/no issues.

- [ ] **Step 4: Verify migration constraint and diff hygiene**

Run:

```bash
git status --short packages/database/drizzle
git diff --check
git status --short
```

Expected: no migration files changed and no whitespace errors.

- [ ] **Step 5: Review spec coverage**

Check every criterion in `docs/superpowers/specs/2026-08-02-calendar-interactions-design.md` against tests and implementation. Report any intentionally deferred item rather than claiming completion.
