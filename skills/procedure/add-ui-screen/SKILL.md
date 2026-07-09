---
name: add-ui-screen
category: procedure
scope: web
description: Add or restructure a page in apps/web. Uses sidebar shell, section-card pattern, iconify-icon Solar icons, react-hook-form for forms.
appliesTo:
  concerns: [layout, interaction, forms, data-fetching, state-management]
autoAttach: manual
combinesWith: [add-tests, keep-docs-current, check-permissions]
conflictsWith: []
---

## Attach when
- Task adds a new route under `apps/web/app/(dashboard)/**` or `apps/web/app/(auth)/**`.
- Task restructures an existing page into new sections/tabs.

## Do
1. Create the route file under the correct group (`(dashboard)` or `(auth)`).
2. Do NOT re-wrap with an outer max-width container — the layout shell handles that.
3. Header row: `<div className="px-6 py-8 border-b border-zinc-100">`.
4. Content: `<div className="p-6 max-w-6xl mx-auto w-full">`.
5. Section cards: `<div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">` with header `px-5 py-4 border-b border-zinc-200 bg-zinc-50/50`, body `p-5`.
6. Icons via `iconify-icon` (Solar linear set) — `<iconify-icon icon="solar:xxx-linear" stroke-width="1.5" />`.
7. Forms: react-hook-form + zod resolver.
8. Loading state: `<div className="py-10 text-center text-sm text-zinc-500">Loading…</div>`.
9. Empty state: rounded-xl card with centered icon + text.

## Rules
- No `"use client"` unless interactivity is required.
- Backend authorization is source of truth; hide-only UI is UX, not security.
- Reuse shared types from packages — never manually duplicate API DTOs.
- Preserve zinc palette + blue accent + Inter font. No ad-hoc colors.

## Docs to update after
- `apps/web/AGENTS.md` — if a new UI pattern was introduced.
