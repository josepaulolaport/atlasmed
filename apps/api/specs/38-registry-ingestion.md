# Spec 38 — Registry Ingestion and CRM Sync

**Domain:** Registry Ingestion · Diff · Suggestions · Registry Read APIs  
**Status:** Implemented (backend)  
**Last Updated:** 2026-06-26  
**Scope:** API, registry schema projection, suggestion workflow, facility registry panels.

**Depends on:** [Spec 0002 — Facility and Professional CRM](../../../../docs/specs/0002-clinic-doctor-crm/requirements.md), [Spec 37 — Territory Management](./37-territory-management.md)

---

## Overview

Registry ingestion imports external healthcare registry data (CNES mock fixtures today) into a separate `registry` schema warehouse, then compares projections against CRM truth in `public`. Conflicts produce reviewable `IngestionSuggestion` records instead of silently overwriting manually maintained fields.

### Layers

| Layer | Schema | Purpose |
|-------|--------|---------|
| Registry warehouse | `registry.*` | Raw CNES-shaped tables (`RegistryFacility`, `RegistryProfessional`, …) |
| CRM truth | `public.*` | Operational `Facility`, `Professional`, associations, representatives |
| Suggestions | `public.ingestion_suggestions` | Human-reviewed diffs between registry and truth |

---

## Ingestion Flow

1. `POST /registry-ingestion/run` acquires a Redis lock and fetches a registry snapshot.
2. `RegistrySyncService` ensures source-tracked shells exist for facilities/professionals/associations.
3. `RegistryDiffService` compares snapshot fields to truth and creates `FACILITY_FIELD_UPDATE` suggestions (no silent overwrites).
4. Absent facilities/associations create deactivation/removal suggestions.
5. Run stats are persisted on `IngestionRun`.

### Suggestion types

| Type | Trigger | Approve action |
|------|---------|----------------|
| `FACILITY_FIELD_UPDATE` | Registry field mismatch | Apply proposed fields; geocode if address changed |
| `FACILITY_REGISTRY_DEACTIVATED` | Facility missing from source | Soft-delete facility (`deletedAt`) |
| `FACILITY_REGISTRY_REACTIVATED` | Deleted facility reappears | Clear `deletedAt` |
| `FACILITY_PROFESSIONAL_REMOVAL` | Association missing from source | End association |

---

## Registry Read APIs (facility-scoped)

All routes require `read` on `CLINIC` and scope enforcement on the facility.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/facilities/:id/registry/facility` | Projected `RegistryFacility` for linked `externalSourceId` |
| GET | `/facilities/:id/registry/professionals` | Registry professionals at facility |
| GET | `/facilities/:id/registry/representatives` | Registry representatives at facility |

Implementation: `RegistryReadService` + `registry-projection.service.ts` in `registry-ingestion` module; routes mounted on facility plugin.

---

## Confirm Flows (PR6)

| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/facilities/:facilityId/registry/professionals/:professionalId/confirm` | `{ occupationCode }` | Confirm registry professional linkage |
| POST | `/facilities/:facilityId/registry/representatives/:externalKey/confirm` | — | Upsert + confirm representative from registry |
| GET | `/facilities/:id/consultant-assignments` | — | Assignment history |
| POST | `/facilities/:id/consultant-assignments` | `{ userId }` | Assign consultant (ends prior open assignment) |

---

## Catalog APIs (PR3)

Admin catalog routes use `CATALOG` subject (`manage` for ADMIN, `read` for MANAGER):

| Method | Path |
|--------|------|
| GET/POST/PATCH | `/sectors`, `/products`, `/healthcare-providers` |
| GET/POST | `/facilities/:facilityId/healthcare-provider-shares` |

Share creation validates total percent ≤ 100%.

---

## Conformity Stubs (PR7)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/conformity/requirements` | Active requirements catalog |
| GET | `/facilities/:id/conformity-records` | Records for facility |
| POST | `/facilities/:id/conformity-records` | Create record (`requirementId`, optional `status`) |

`Facility.conformityStatus` aggregation is deferred; records are persisted only.

---

## Permissions

| Subject | ADMIN | MANAGER | USER |
|---------|-------|---------|------|
| `REGISTRY_INGESTION` | manage | — | — |
| `REGISTRY_SUGGESTION` | manage | read/update | — |
| `CATALOG` | manage | read | — |
| `CLINIC` | manage | read/update | read/update |

---

## Known Limitations / Blockers

- Registry warehouse tables are empty until a real CNES loader populates `registry.*`; read APIs return 404/empty without linked `externalSourceId` or registry rows.
- Mock fixtures drive ingestion only; they do not write to `registry` schema tables.
- Representative registry model is 1:1 per facility in CNES export; multiple representatives require schema extension.
- Conformity status on `Facility` is not auto-recomputed from records yet.
