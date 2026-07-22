# Spec 0007: Não Conformidades — Design

**Status:** Draft — product decisions locked  
**Last Updated:** 2026-07-22  
**Requirements:** [requirements.md](./requirements.md)

## 1. Problem

Field teams need to correct clinic **administrative** data without bypassing review. Mobile already mocks a Não Conformidades queue. There is no user-submitted suggestion store today for that UX.

We need a first-class CRM suggestion pipeline for ad-hoc facility corrections, with **mandatory geocode on address accept**, **supersede-on-resubmit**, and **zero coupling to CNES / registry-ingestion**.

## 2. Chosen approach

### New `public.field_suggestions` + module `field-suggestions`

- Own table and enums in the `public` schema
- Module product name: Não Conformidades
- Shares only generic infrastructure: facility repository mutations, `FacilityGeocodingService`, audit logging
- Does **not** use `ingestion.cnes_suggestions`, does **not** call registry approve/reject use-cases, does **not** appear under `/registry-suggestions`

### Rejected alternatives

| Option | Why rejected |
|---|---|
| Extend `ingestion.cnes_suggestions` | Requires `cnes_run_id`; registry semantics; pollutes ingestion analytics |
| Direct PATCH with pending flags on facility columns | Hard to reject; weak audit of proposed vs current |

## 3. Module layout (`apps/api`)

```
apps/api/src/modules/field-suggestions/
  application/
    interfaces/field-suggestion.repository.interface.ts
    use-cases/
      create-facility-field-suggestion.use-case.ts
      list-field-suggestions.use-case.ts
      get-field-suggestion.use-case.ts
      approve-field-suggestion.use-case.ts
      reject-field-suggestion.use-case.ts
    services/
      field-suggestion-apply.service.ts   # maps fieldKey → facility update + geocode
  infrastructure/
    repositories/drizzle/drizzle-field-suggestion.repository.ts
    routes/
      facility-field-suggestions.route.ts  # POST + GET mine under /facilities/:id
      field-suggestions.route.ts           # ops list/detail/approve/reject
  composition.ts
  index.ts
  field-suggestions-http.integration.test.ts
```

Routes import use-cases only from `composition.ts`.

## 4. Persistence

### 4.1 Table `public.field_suggestions`

| Column | Type | Notes |
|---|---|---|
| `id` | text PK (cuid) | |
| `kind` | enum `FIELD_CHANGE` \| `DEACTIVATION` | |
| `status` | enum `PENDING` \| `APPROVED` \| `REJECTED` | Superseded rows use `REJECTED` (no separate SUPERSEDED status in v1) |
| `facility_id` | text FK → facilities NOT NULL | |
| `professional_id` | text FK nullable | unused in v1; reserved |
| `field_key` | text nullable | required when `FIELD_CHANGE`; null for deactivation |
| `current_value` | jsonb | snapshot at submit time (scalar or address object) |
| `proposed_value` | jsonb | scalar or address object; null for deactivation |
| `reason` | text nullable | submitter note |
| `submitted_by_user_id` | text FK → users NOT NULL | |
| `submitted_at` | timestamptz default now | |
| `resolved_at` | timestamptz nullable | |
| `resolved_by_user_id` | text nullable | null for system supersession, or submitter of the new row |
| `resolution_note` | text nullable | e.g. `Superseded by <newId>` |
| `created_at` / `updated_at` | timestamptz | |

Indexes:

- `(status, submitted_at desc)` — ops queue
- `(facility_id, submitted_by_user_id, submitted_at desc)` — mine list
- `(facility_id, field_key, status)` — supersede lookup for field changes
- `(facility_id, kind, status)` — supersede lookup for deactivation

### 4.2 Allowed `field_key` values (v1 — administrative)

Align with Dados administrativos / header pencils. **Do not include `commercialStatus`.**

| `field_key` | Facility columns | `proposed_value` shape |
|---|---|---|
| `displayName` | `displayName` | string |
| `legalName` | `legalName` | string (if editable in UI) |
| `taxId` / structured tax fields | `taxIdType`, `cnpj`, `cpf` as UI exposes | string or small object — match mobile pencil |
| `phoneNumber` | `phoneNumber` | string |
| `whatsappNumber` | `whatsappNumber` | string |
| `email` | `email` | string |
| `websiteUrl` | `websiteUrl` | string |
| `responsibleName` | `responsibleName` | string |
| `openingHours` | `openingHours` | string |
| `address` | `neighborhood`, `streetAddress`, `streetNumber`, `addressComplement` (+ optional `city`, `state`, `postalCode`, `country`) | object |

Address is **one** suggestion with a structured object (matches mobile address sheet), not four independent suggestions, so geocode runs once.

Disallowed examples (422): `commercialStatus`, `purchaseStatus`, `conformityStatus`, doctor personal fields, arbitrary lat/lng-only patches.

### 4.3 Migration

Follow `packages/database` workflow: edit schema → `drizzle-kit generate` → review SQL → migrate. Never hand-edit `drizzle/*`.

## 5. API contract

Base prefix: `/api/v1`. All protected routes: `.use(auth).use(requirePermission(...))` + `getScope()`.

### 5.1 Create (mobile pencil / deactivation)

`POST /facilities/:id/field-suggestions`

```json
{
  "kind": "FIELD_CHANGE",
  "fieldKey": "address",
  "proposedValue": {
    "neighborhood": "Jardim Paulista",
    "streetAddress": "Av. Paulista",
    "streetNumber": "1000",
    "addressComplement": "Cj 12",
    "city": "São Paulo",
    "state": "SP",
    "postalCode": "01310-100"
  },
  "reason": "Placa na fachada"
}
```

Deactivation:

```json
{
  "kind": "DEACTIVATION",
  "reason": "Clínica encerrada"
}
```

**Behavior (single transaction):**

1. Load facility; `assertResourceInScope(scope, "facility", id)`.
2. Validate kind / fieldKey / proposedValue (Zod + allow-list). Reject `commercialStatus` etc.
3. Snapshot `currentValue` from live facility (never trust client “current”).
4. **Supersede:** find matching `PENDING` rows:
   - `FIELD_CHANGE`: same `facility_id` + `field_key`
   - `DEACTIVATION`: same `facility_id` + `kind = DEACTIVATION`
   Mark each `REJECTED` with `resolution_note = "Superseded by <newId>"` (generate new id first or use a two-step note update), `resolved_at = now()`, audit `field_suggestion_superseded`.
5. Insert new `PENDING` row; audit `field_suggestion_created`.
6. Return DTO (201).

### 5.2 List mine (establishment shortcut)

`GET /facilities/:id/field-suggestions?mine=true&status=&page=&limit=`

Forces `submittedByUserId = auth.userId`. Still scope-checks facility.

### 5.3 Ops queue

`GET /field-suggestions?status=PENDING&page=&limit=&facilityId=`

Scope: if not global, filter `facility_id IN scope.facilityIds` (empty → empty list).

`GET /field-suggestions/:id`

### 5.4 Approve / reject

`POST /field-suggestions/:id/approve` body: `{ "resolutionNote"?: string }`  
`POST /field-suggestions/:id/reject` body: `{ "resolutionNote"?: string }`

**Self-approve:** MANAGER (scoped) and ADMIN may approve a suggestion they themselves submitted. REP cannot approve/reject.

Approve algorithm (pseudo):

```
in transaction:
  lock suggestion row (FOR UPDATE)
  assert PENDING + in scope + role may review
  switch kind:
    DEACTIVATION → softDelete(facilityId)
    FIELD_CHANGE → applyField(facility, fieldKey, proposed)
      if fieldKey == address:
        coords = geocodingPort.forwardGeocode(compose(address))
        if !coords → throw → rollback
        set location from coords
        schedule onFacilityLocationChanged(facilityId) after commit
  mark APPROVED + resolver metadata
  audit
```

Reject: status only + audit (distinct from supersession audits).

### 5.5 DTO (shared)

```ts
{
  id: string
  kind: "FIELD_CHANGE" | "DEACTIVATION"
  status: "PENDING" | "APPROVED" | "REJECTED"
  facilityId: string
  facilityName: string
  fieldKey?: string
  fieldLabel: string          // server-derived pt-BR label for mobile
  currentValue: unknown      // JSON
  proposedValue: unknown
  reason?: string
  submittedByUserId: string
  submittedByName: string
  submittedByRole: string     // from user.role
  submittedAt: string         // ISO
  resolvedAt?: string
  resolvedByUserId?: string
  resolvedByName?: string
  resolutionNote?: string
}
```

Mobile maps this onto `NaoConformidadeSuggestion` (drop doctor fields for v1).

## 6. Geocoding design

### 6.1 Complete `FacilityGeocodingService`

Today `resolveCoordinates` does not call Mapbox. Extend:

```ts
async geocodeAddress(parts: AddressParts): Promise<{ lat: number; lng: number } | null>
async resolveCoordinates(input: {
  lat?: number | null
  lng?: number | null
  address?: AddressParts | null
}): Promise<ResolvedCoordinates>
```

Rules:

- If both lat/lng provided → use them (`geocoded: false`).
- Else if address provided → `forwardGeocode` with `country: "br"` (`geocoded: true` on success).
- Else → nulls.

`ensureCoordinatesPersisted` should compose address from the facility row when lat/lng missing (lazy backfill).

### 6.2 Apply path for NC accept

Expand facility apply helper (e.g. `applyCrmFieldPatch`) for the administrative allow-list including address columns + location. Used only by `ApproveFieldSuggestionUseCase` in this epic (not registry-ingestion).

Always set `manuallyEditedAt` on NC-driven applies.

### 6.3 Failure mode

Transactional: geocode failure → entire accept rolls back; HTTP **422** with issue on `address`. Suggestion stays `PENDING`.

### 6.4 Side effects after location change

Reuse `onFacilityLocationChanged` from `UpdateFacilityUseCase`. Always invoke after successful address geocode.

## 7. Authorization

### 7.1 Subject

Add CASL subject `FIELD_SUGGESTION` in `packages/access` (preferred).

| Role | create | read ops queue | approve/reject |
|---|---|---|---|
| ADMIN | yes | yes (global) | yes (incl. own) |
| MANAGER | yes (scope) | yes (scope) | yes (incl. own, scope) |
| REP | yes (scope) | no (mine only) | no |
| OPS | optional create | yes | yes |

Interim fallback (tech debt): create via `update FACILITY`; approve via role check ADMIN/MANAGER only — migrate to `FIELD_SUGGESTION` in the same epic if possible.

### 7.2 Own-only list

Mine endpoint filters `submitted_by_user_id = auth.userId`. Ops detail of someone else’s suggestion is allowed for reviewers only.

## 8. Mobile wire-up

1. API client methods on existing session HTTP stack.
2. Replace in-memory `naoConformidadeProvider` with API-backed notifier.
3. Pencil + address sheets → `POST` create; snackbar on success; keep form state on failure.
4. Deactivation sheet → `kind: DEACTIVATION`.
5. Ops screens → list/approve/reject (`canReview: true`).
6. Establishment own list → `mine=true` (`canReview: false`).
7. Remove mock seeds; drop unused doctor NC types if still present.

## 9. Testing strategy

| Layer | Cases |
|---|---|
| Unit | create snapshots current; supersede rejects older pending same field; supersede deactivation; approve applies phone; approve address geocode success/fail; reject no-op on facility; REP cannot approve; MANAGER self-approve ok; double-approve 422; `commercialStatus` 422 |
| Integration HTTP | 401/403/422/201/200; scope denied; mine filter |
| Geocoding | fake `GeocodingPort`; location updated; `onFacilityLocationChanged` once |
| Mobile | DTO → model mapping |

## 10. Observability & audit

| Action | When |
|---|---|
| `field_suggestion_created` | after insert |
| `field_suggestion_superseded` | when older PENDING auto-rejected on create |
| `field_suggestion_approved` | after successful apply (+ `geocoded` in metadata when address) |
| `field_suggestion_rejected` | explicit reject by reviewer |
| `field_suggestion_geocode_failed` | log only on accept failure |

Never log Mapbox tokens.

## 11. Relation to Spec 0005 F-015

F-015 Phase 2 for **facilities** is entirely this spec: user-submitted rows in `public.field_suggestions`. Professional personal fields remain deferred. No registry-ingestion reuse beyond “similar UX.”

## 12. Locked product answers (was open questions)

| # | Decision |
|---|---|
| 1 | MANAGER **may** self-approve within scope. |
| 2 | `commercialStatus` is **out of scope**; v1 = administrative fields + deactivation. |
| 3 | **Supersede:** auto-reject older matching `PENDING` on create. |
| 4 | Always invoke `onFacilityLocationChanged` after successful address geocode. |
