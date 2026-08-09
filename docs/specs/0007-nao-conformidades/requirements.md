# Spec 0007: Não Conformidades (Field Suggestions)

**Status:** Draft for implementation — product decisions locked  
**Last Updated:** 2026-07-22  
**Domains:** `apps/api`, `apps/mobile`, `packages/database`, `packages/access`, `packages/mapbox`  
**Related:**
- [Spec 0002 — Facility and Professional CRM](../0002-clinic-doctor-crm/requirements.md) (AC5: approving address changes SHALL trigger geocoding)
- [Spec 0005 — Mobile Establishment Detail](../0005-establishment-detail-mobile/requirements.md) (F-015 Phase 2)
- [api-mobile integration](../../ai/integration-tasks/api-mobile.md)

> **Scope boundary:** This feature is **user-submitted only**. It does not read, write, extend, or share a review queue with any CNES registry warehouse (removed). Do not couple Não Conformidades to a reintroduced registry-suggestion surface without a new ADR.

## User Story

As a field representative (or manager) in the mobile app, I want to propose corrections to clinic administrative data (and request clinic deactivation) without writing CRM truth directly, so that reviewers can accept or reject those changes with a clear audit trail.

As a reviewer (MANAGER in scope, or ADMIN), I want a queue of pending Não Conformidades so I can accept or reject each suggestion; when I accept an address change, the system must geocode the new address and update the clinic’s map point before the change is considered applied.

## Product scope (v1)

| In scope | Out of scope (deferred) |
|---|---|
| Facility / clinic **administrative** field-change suggestions | Doctor / professional personal-field suggestions |
| Facility **deactivation** requests | `commercialStatus` (and related Sinais) edit flows — separate product logic |
| Ops queue: list / detail / accept / reject | Web admin UI (mobile first; web can reuse API later) |
| “My suggestions” on the establishment (own submissions, view-only) | Document / cadastro approval queue |
| Geocode-on-accept for address suggestions | Live geocode preview in the submit sheet |
| Supersede: auto-reject older pending on resubmit | Any coupling to a CNES registry-suggestion queue (removed) |

Mobile Phase 1 mock UX already exists under `apps/mobile/lib/features/nao_conformidades/`. This spec is the backend + wire-up contract that replaces that mock.

## Locked decisions

1. **User-only store in `public`.** Persist in `public.field_suggestions`. No `cnes_run_id`, no `ingestion`/`registry` schema coupling, no shared approve path with a CNES warehouse.
2. **Clinic-only v1.** Schema may reserve `professional_id` for later; APIs and mobile do not accept doctor targets in v1.
3. **No direct PATCH of CRM fields from field pencils.** Pencils always create a pending suggestion. Accept applies the change.
4. **Administrative fields + deactivation.** v1 covers Dados administrativos edits (name, contact, address, hours, responsible, tax identifiers as exposed by pencils, etc.) and kind `DEACTIVATION`. **`commercialStatus` is out of scope** for this pipeline.
5. **Address is structured.** Suggestions carry neighborhood / street / number / complement (and optionally city / state / postal code when editable). Display may compose a single line; storage and geocode input use structured fields.
6. **Accepting an address change MUST geocode.** See [Geocoding invariants](#geocoding-invariants).
7. **Deactivation is a first-class kind**, not a field update of `commercial_status`. Accept soft-deactivates the facility (existing soft-delete / `deactivatedAt` path) with audit.
8. **MANAGER may self-approve** suggestions they submitted, as long as the facility remains in their scope. ADMIN may always approve. REP may submit only; cannot approve/reject.
9. **Supersede on resubmit.** When a new suggestion is created for the same facility and the same pending “slot” (same `field_key` for `FIELD_CHANGE`, or another `DEACTIVATION` for that facility), the system SHALL, in one transaction: mark every older matching `PENDING` row as `REJECTED` with a system resolution note, then insert the new `PENDING` row.
10. **Scope + CASL.** Submit and review are both scope-aware. Reviewers cannot accept suggestions for facilities outside their territory scope.

## Acceptance criteria

### Submit

1. WHEN a scoped user submits a field suggestion for a facility in scope THEN the system SHALL create a `PENDING` suggestion capturing `fieldKey`, current snapshot (server-side), proposed value(s), optional reason, and `submittedByUserId`.
2. WHEN the same user opens Não Conformidades on that establishment THEN the system SHALL list only that user’s submissions for that facility (any status).
3. WHEN a user submits a deactivation request THEN the system SHALL create a suggestion with kind `DEACTIVATION`, optional reason, and without a field payload.
4. WHEN a user submits a `FIELD_CHANGE` and one or more `PENDING` suggestions already exist for the same `facility_id` + `field_key` THEN the system SHALL reject those older rows (`REJECTED`, resolution note indicating supersession by the new id) and create the new `PENDING` row in the same transaction.
5. WHEN a user submits a `DEACTIVATION` and a `PENDING` deactivation already exists for that facility THEN the system SHALL reject the older pending deactivation(s) the same way, then create the new one.
6. IF the facility is outside the user’s scope OR the user lacks permission THEN the system SHALL reject the submit with 403.
7. IF validation fails (unknown field, empty proposed value when required, malformed address object, `commercialStatus` or other disallowed keys) THEN the system SHALL return 422 with structured issues.

### Ops review queue

8. WHEN a reviewer lists the queue THEN the system SHALL return suggestions filtered by status (default `PENDING`) and restricted to facilities in the reviewer’s scope (global for ADMIN).
9. WHEN a reviewer (including the original submitter, if MANAGER/ADMIN) accepts a non-address field suggestion THEN the system SHALL apply the proposed value to the facility, set status `APPROVED`, record resolver + timestamps + optional note, and emit an audit event.
10. WHEN a reviewer rejects a suggestion THEN the system SHALL set status `REJECTED` without mutating facility CRM fields, and emit an audit event.
11. IF the suggestion is not `PENDING` THEN accept/reject SHALL fail with 422.
12. WHEN a reviewer accepts a deactivation suggestion THEN the system SHALL soft-deactivate the facility using the same lifecycle rules as other deactivation paths.
13. REP SHALL NOT be able to approve or reject (403), including their own submissions.

### Geocoding (address accept)

14. WHEN a reviewer accepts a suggestion with `fieldKey: "address"` THEN the system SHALL:
    a. Persist the approved address fields on the facility;
    b. Build a geocode query from the resulting address (structured → single query string);
    c. Call the Mapbox forward geocoder (`GeocodingPort`);
    d. Persist the returned `lat`/`lng` on `facilities.location`;
    e. Run the existing post-location-change hook (territory reassignment / search sync as already wired for facility location updates).
15. IF geocoding returns no result or the port errors THEN the accept SHALL fail, the suggestion SHALL remain `PENDING`, and no partial facility mutation from that accept attempt SHALL remain committed (transactional accept).
16. WHEN a suggestion does not touch address fields THEN the system SHALL NOT call the geocoder on accept.

### Audit & observability

17. WHEN a suggestion is created, approved, rejected (including supersession) THEN the system SHALL write a structured audit log with stable action names (`field_suggestion_created`, `field_suggestion_approved`, `field_suggestion_rejected`, `field_suggestion_superseded`).
18. Geocode failures on accept SHALL be logged with facility id and suggestion id (no tokens).

## Geocoding invariants

| Rule | Detail |
|---|---|
| Trigger | Only on **accept** of `fieldKey: "address"` |
| Address keys (v1) | `neighborhood`, `streetAddress`, `streetNumber`, `addressComplement`, and when present `city`, `state`, `postalCode`, `country` |
| Query composition | Prefer: `{streetAddress}, {streetNumber} - {addressComplement}, {neighborhood}, {city} - {state}, {postalCode}, Brazil` (omit empty parts) |
| Coordinates source of truth | PostGIS `facilities.location`; DTO exposes `lat`/`lng` as today |
| Manual lat/lng suggestions | Out of scope for v1 pencils |
| Shared service | Extend `FacilityGeocodingService` so facility create/update and NC accept share one geocode path |
| Post-accept | Always invoke existing `onFacilityLocationChanged` after a successful address geocode (hook may no-op if territory unchanged) |

## Permissions (initial)

| Action | Roles (intent) | Notes |
|---|---|---|
| Create suggestion | REP, MANAGER (in scope); ADMIN | |
| List own suggestions for a facility | Same as create + read facility | Filter `submittedByUserId` |
| List ops queue / accept / reject | ADMIN; MANAGER (scope) | Self-approve allowed for MANAGER |
| Approve / reject | Not REP | |

Exact CASL subject naming is in [design.md](./design.md). Backend remains source of truth; mobile only hides affordances.

## Non-goals

- Any persistence or API shared with a CNES registry-suggestion queue (removed)
- `commercialStatus` / Sinais editing via this pipeline
- Auto-accept without an explicit approve action
- Offline sync queue for suggestions (submit may be online-only in v1; form should not lose typed values on retry)
- Changing Spec 0005 visual redesign beyond wiring pencils to the new API

## Traceability to mobile mock

| Mobile concept | API concept |
|---|---|
| `NaoConformidadeKind.fieldChange` | `kind: FIELD_CHANGE` |
| `NaoConformidadeKind.deactivation` | `kind: DEACTIVATION` |
| `NaoConformidadeStatus.pending/accepted/rejected` | `PENDING` / `APPROVED` / `REJECTED` |
| Ops list `/nao-conformidades` | `GET /api/v1/field-suggestions` |
| Detail accept/reject | `POST .../approve` / `.../reject` |
| Clinic “Não Conformidades” own list | `GET /api/v1/facilities/:id/field-suggestions?mine=true` |
| Pencil + address sheet | `POST /api/v1/facilities/:id/field-suggestions` |
| Deactivation sheet | `POST` with `kind: DEACTIVATION` |
