# apps/mobile/AGENTS.md

## Scope

Flutter mobile app. Applies when modifying:

- `apps/mobile/**`
- Mobile UI (screens, widgets)
- Map behavior, route planning, territory rendering
- Visit logging, geofence, visit forms, visit history
- Mobile KPIs, offline sync, background location
- GPS / geofence / battery handling

Migration target (React Native + Expo) is documented in `docs/architecture/adr/0002-mobile-stack.md`. Until then, treat Flutter as active.

## Required docs by task

| Task | Load |
|---|---|
| General mobile work | `docs/architecture/current.md` (mobile section), `docs/architecture/target.md` |
| Map / route / territory | `docs/specs/0003-territory-management/requirements.md` |
| Visit logging | TODO: `docs/product/visits.md` (not yet created) |
| API-backed mobile feature | `docs/ai/integration-tasks/api-mobile.md`, `packages/types/AGENTS.md` |
| Auth / permissions | `packages/access/AGENTS.md`, `docs/architecture/features/access-auth.md` |

## Conventions

- Widgets are small. Split UI, state, and data access into separate files.
- Do not hardcode API response shapes when shared types exist in `packages/types` — generate or mirror them explicitly.
- Preserve fast route recalculation and map interaction — profile before adding heavy widgets.
- Handle offline first for visit logging: assume network can fail mid-form.
- Respect GPS/battery: no continuous foreground GPS unless the user is actively navigating.

## Anti-patterns

- Do not import from `apps/api` or `apps/web`.
- Do not couple to database row types — consume backend DTOs only.
- Do not add new native plugins without noting platform impact (iOS + Android build changes).

## Stack migration note

If the task specifically implements the RN/Expo migration, follow ADR 0002 and coordinate with `docs/architecture/target.md`. Otherwise, keep working in Flutter without introducing RN concepts.
