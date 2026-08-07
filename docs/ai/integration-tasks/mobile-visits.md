# Mobile Visits Integration

Use when a task changes the visit-logging flow, geofence, visit forms, visit history, or map/route behavior in `apps/mobile`.

## Load

**Always:**
- `AGENTS.md` (§ `apps/mobile`)

**Conditional:**

| Concern | Load |
|---|---|
| Backend sync needed | `docs/ai/integration-tasks/api-mobile.md` |
| authorization / security | `AGENTS.md` § `packages/access`, `docs/architecture/features/access-auth.md` |
| Map/route behavior | `docs/specs/0003-territory-management/requirements.md` |
| Product feature definition | TODO `docs/product/visits.md` |
| testing (api-side) | `apps/api/TESTING.md` |

## Work order

1. Identify the visit flow being changed.
2. Design offline-first: form must survive network failure mid-submission.
3. GPS discipline: no continuous foreground GPS unless the user is actively navigating.
4. Preserve fast route recalculation and map interaction — profile before adding heavy widgets.
5. If sync to backend is needed, escalate to `api-mobile` integration.
6. Add tests for the offline path and the reconnect path.

## Rules

- Handle GPS + battery carefully — background GPS drains devices.
- Never trust device timestamps for auditable events without server confirmation.
- Do not store PII beyond what the visit form needs.
- Do not add native plugins without noting platform impact (iOS + Android).

## Docs to update after

- Root `AGENTS.md` § `apps/mobile` — if a visit pattern shifted.
- TODO `docs/product/visits.md` — if visit business rules changed.
