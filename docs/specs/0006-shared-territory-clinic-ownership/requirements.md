# Spec 0006: Shared Territory Coverage & Clinic-Level Ownership

**Status:** Draft — deferred (problem captured; design not started)  
**Created:** 2026-07-22  
**Related:** [Spec 0003 — Territory Management](../0003-territory-management/requirements.md), [Spec 0005 — Establishment Detail (mobile)](../0005-establishment-detail-mobile/requirements.md), [Spec 0002 — Facility and Professional CRM](../0002-clinic-doctor-crm/requirements.md)

## User Story

As a sales manager, I want multiple representatives to operate in the same geographic neighborhood while each remains clearly responsible for different clinics, so that territory maps stay manageable and access, reporting, routing, and reassignment reflect real commercial ownership—not artificial micro-polygons.

## Problem statement

### Current model (Spec 0003)

- **Manager zones** contain non-overlapping **rep patches** (`managerTerritoryId`, `ST_CoveredBy`).
- Sibling territories of the same type **must not overlap**.
- Clinics with coordinates and `territoryAssignmentSource = geo` are assigned to the containing rep patch via `ST_Covers` → single `facilities.territoryId`.
- Manual clinic overrides exist (`territoryAssignmentSource = manual`) but the primary mental model remains **one geo area → one rep**.

### Real-world practice

- Several representatives may work the **same neighborhood** (or overlapping streets).
- Ownership is often **clinic-level**: rep A owns clinic X on street S; rep B owns clinic Y next door.
- Encoding that solely as exclusive polygons forces:
  - tiny, overlapping, or nested shapes;
  - polygons that cover a single clinic inside another rep’s area;
  - brittle editing, reassignment, and analytics.

### Challenge

Support **shared geographic coverage** and **direct clinic ownership** at the same time, while keeping:

- territory editing usable on mobile/web maps;
- attribution and reporting consistent;
- access/scope resolution correct and cacheable;
- reassignment and audit manageable for managers and ops.

## Goals (when this spec is implemented)

1. Allow multiple reps to have **coverage interest** in the same geography without requiring exclusive non-overlapping rep patches for every clinic.
2. Make **clinic ownership** (or equivalent authoritative assignment) the source of truth for “who owns this account” when geo alone is ambiguous.
3. Keep manager-level aggregation (zones / grouping) coherent for filters and analytics.
4. Preserve or replace Spec 0003 rules explicitly—no silent dual truth between polygon membership and clinic owner.
5. Support reassignment of clinics (and bulk moves) without redrawing micro-polygons.
6. Remain compatible with mobile establishment detail (consultor, territory warnings) and existing scope caches.

## Non-goals (for this draft)

- Implementing schema or API changes in the same PR as Spec 0005 establishment wiring.
- Redesigning IBGE / grouping geography ingestion.
- Solving multi-tenancy org boundaries (Spec 0001).
- CNES / registry confirmation workflows.

## Working hypotheses (to validate in design)

These are **not** locked decisions—candidates for the design phase:

| Hypothesis | Rationale |
|---|---|
| **Polygons become coverage / navigation hints**, not exclusive ownership | Avoids micro-polygon hell when many reps share a bairro |
| **Authoritative ownership is clinic-level** (assignment to user and/or territory) | Matches how sales actually divide accounts |
| **Geo auto-assign is optional or soft** when coverage overlaps | Manual/clinic owner wins when multiple patches cover a point |
| **Manager zones may stay exclusive** while rep coverage may overlap | Managers still need clean rollup; reps need shared streets |
| Existing `facility_consultant_assignments` may inform “responsible rep” UX | Already clinic↔user; may align with ownership, or stay separate from territory scope |

## Acceptance criteria (target — refine in design)

1. WHEN two reps are configured to operate in the same neighborhood THEN the system SHALL NOT require non-overlapping exclusive polygons that isolate each clinic.
2. WHEN a clinic has an authoritative owner (clinic-level assignment) THEN access, reporting attribution, and establishment “consultor / equipe” semantics SHALL prefer that owner over ambiguous geo hits.
3. WHEN a point falls inside multiple coverage shapes THEN the system SHALL resolve clinic membership by an explicit precedence rule (documented)—not by undefined DB race or reject-only behavior.
4. WHEN a manager reassigns a clinic from rep A to rep B THEN the system SHALL update ownership without requiring redraw of territory boundaries (unless product also wants coverage updated).
5. WHEN scope is resolved for a REP THEN the system SHALL include clinics they own (and any remaining geo-scoped rules the design keeps), with cache invalidation on ownership change.
6. WHEN territory editing tools are used THEN overlapping coverage SHALL be allowed only where the design permits, with clear UI affordances (e.g. “coverage” vs “exclusive zone”).
7. WHEN analytics aggregate by territory or manager zone THEN clinics SHALL not be double-counted across reps unless the report is explicitly multi-owner.
8. WHEN an ownership or coverage change occurs THEN the system SHALL audit actor, before/after, and reason where applicable.

## Impacted areas (expected)

| Area | Why |
|---|---|
| Spec 0003 boundary validation (no sibling overlap) | Likely relaxed or split by territory “mode” |
| `facilities.territoryId` + geo recompute jobs | May become secondary to clinic ownership |
| Scope resolver / Redis session cache | Must key off ownership + territories |
| Territory map editor (mobile/web) | UX for shared coverage |
| Establishment detail (`regionZoneLabel`, territory warnings) | Labels must match new truth |
| Reporting / analytics-view | Attribution rules |

## Open questions

1. Is **clinic owner** a `user_id`, a `territory_id`, or both?
2. Do overlapping **rep coverage** polygons remain first-class, or do we drop exclusive rep patches in favor of clinic lists + optional soft areas?
3. How do **manager zones** relate to shared rep coverage (still exclusive? still `ST_CoveredBy`?)?
4. Should geo auto-assign **stop** when any overlap exists, or always yield to clinic owner?
5. Can one clinic have **co-owners** / shared credit, or strictly one owner?
6. Migration: how to convert today’s exclusive patches + `territoryId` into the new model without locking users out?
7. Does `facility_consultant_assignments` become the ownership table, or stay a separate CRM “responsible consultant” concept?

## Suggested design phase (later)

1. Product workshop: ownership vs coverage vocabulary; exclusivity rules per territory type.
2. ADR: chosen model (e.g. “shared coverage + clinic owner FK”).
3. Design doc: schema, scope algorithm, migration, API deltas vs Spec 0003.
4. Tasks: backend → web/mobile territory editor → establishment labels → analytics.

## Out of scope until design is approved

- No production schema migration for this problem.
- No change to Spec 0003 implementation behavior.
- Spec 0005 may continue wiring establishment detail using current `consultantName` / assignments / `territoryId` without blocking on this spec.
