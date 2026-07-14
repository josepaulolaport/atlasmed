# Web + BI / Dashboard Integration

Use when a task adds or modifies a BI dashboard card, KPI, manager view, or admin report in `apps/web`.

## Load

**Always:**
- `AGENTS.md`
- `apps/web/AGENTS.md`

**Conditional:**

| Concern | Load |
|---|---|
| Backend metric doesn't exist yet | `docs/ai/integration-tasks/api-web.md` (escalate to cross-boundary) |
| authorization / security | `packages/access/AGENTS.md` |
| performance (heavy query) | `packages/observability/AGENTS.md` |
| Product KPI definition | `docs/product/overview.md` (bi-kpis doc doesn't exist yet) |

## Work order

1. Identify the KPI definition (product owner or existing product doc).
2. Confirm the data source. Does the API already expose the metric?
3. If yes: fetch, display, done. If no: escalate to `api-web` and add the endpoint first.
4. Reuse existing dashboard layout patterns from `apps/web/AGENTS.md` — don't invent a new grid.
5. Add loading, empty, and error states.
6. Ensure manager/admin visibility rules are respected.
7. Verify the card renders correctly with real data.

## Rules

- Do not invent KPI definitions in the frontend.
- Do not calculate sensitive business metrics differently from the backend.
- Keep chart behavior consistent with existing BI screens.
- Do not add heavy chart libraries without explicit approval.

## Docs to update after

- `apps/web/AGENTS.md` — if a dashboard pattern shifted.
- TODO `docs/product/bi-kpis.md` — if the KPI definition itself changed.
