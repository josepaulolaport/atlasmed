# ADR 0005: Facility vertical REP assignments parented by profile

**Status:** Accepted  
**Date:** 2026-08-07  
**Relates:** Spec 0006 (clinic ownership), Spec 0003 vertical-ownership design

## Context

Clinic ownership was stored in `facility_consultant_assignments` with denormalized `(facility_id, vertical_id)`. Multi-vertical work already treats `facility_vertical_profiles` as “facility participates in this vertical.” Keeping a parallel pair of FKs on the assignment table duplicated that parent and made facility-global unassign incorrect.

## Decision

Hard-cut to `facility_vertical_rep_assignments`:

- Parent FK: `facility_vertical_profile_id` → `facility_vertical_profiles`
- One active row per profile (`ended_at IS NULL`)
- Assign upserts/reactivates the profile (`is_active = true`)
- Unassign ends the active assignment only (profile stays)
- Deactivate vertical ends active assign + sets `is_active = false`

Canonical API (mobile + API; web out of scope this wave):

| Action | Method + path |
|---|---|
| Assign / replace | `PUT /facilities/:facilityId/verticals/:verticalId/rep` |
| Unassign | `DELETE /facilities/:facilityId/verticals/:verticalId/rep` |
| History | `GET /facilities/:facilityId/verticals/:verticalId/rep-assignments` |
| Deactivate vertical | `DELETE /facilities/:facilityId/verticals/:verticalId` |

Responsible REP for `(facility, vertical)` remains the **active direct assignment** only (Spec 0006). Territory / patch UTA does not derive consultant display or REP clinic list access.

## Consequences

- Old `/consultant-assignments` routes removed in the same cut.
- Boundary impact and unassigned-clinic queries join through profiles.
- Mobile display fields may keep `consultantName` / `consultantSince`; repository URLs are vertical-scoped.
- List/detail still collapse to one `consultantName`. Multi-vertical scope uses stable lowest-`verticalId` tie-break today.

## Deferred (much later)

**Single-vertical consultant display:** when actor has an active vertical (`activeLinhaId` / single vertical in scope), `consultantName` / `consultantSince` must resolve for **that** vertical only (Alice on Ortopedia, Bob on Estética). Not in this wave.
