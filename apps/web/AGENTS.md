<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

Next.js 16 has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# apps/web/AGENTS.md

## Scope

Next.js 16 admin/web app. Applies when modifying:

- `apps/web/**`
- Admin screens (facilities, professionals, territories, users, registry-suggestions)
- Manager dashboards, BI dashboards
- Tables, filters, forms
- Auth flows (login, 2fa, register, forgot/reset password)

## Stack

- Next.js 16 (App Router)
- React 19
- Tailwind CSS 4 (zinc palette + blue accent, Inter font)
- `iconify-icon` web component (Solar icon set)
- Radix UI primitives for dialogs/dropdowns/select/switch/toast
- react-hook-form + zod for forms
- axios for API client

## Required docs by task

| Task | Load |
|---|---|
| General web work | this file, `apps/web/README.md` |
| Auth screens | `packages/access/AGENTS.md`, `docs/architecture/features/access-auth.md` |
| Facility / professional / territory management | `docs/architecture/features/clinic-doctor-registry.md`, `docs/specs/0003-territory-management/requirements.md` |
| Registry suggestions | `docs/architecture/features/clinic-doctor-registry.md`, `apps/api/AGENTS.md` |
| API-backed feature | `docs/ai/integration-tasks/api-web.md`, `packages/types/AGENTS.md` |
| Multi-tenancy UI | `docs/specs/0001-multi-tenancy/design.md` |

## Conventions

- **Language: Brazilian Portuguese (pt-BR) only.** All user-visible UI text (labels, buttons, headings, placeholders, nav, empty/loading states, table headers, dialogs, `aria-label`/`title`, page metadata) MUST be in pt-BR. `<html lang="pt-BR">` is set in `app/layout.tsx`. No i18n framework — strings live in-place. New UI ships translated; do not add English copy.
- Dates/numbers use the `pt-BR` locale (dd/mm/aaaa). Prefer the `formatDate`/`formatDateTime` helpers in `lib/utils.ts`; any inline `toLocaleDateString`/`toLocaleString` must pass `"pt-BR"`.
- Design tokens are zinc palette + blue accent + Inter font. Do not introduce ad-hoc colors.
- Use `iconify-icon` with Solar linear icons; do not re-introduce lucide-react.
- Section cards: `rounded-xl border border-zinc-200 bg-white shadow-sm`, header `px-5 py-4 border-b border-zinc-200 bg-zinc-50/50`, body `p-5`.
- Page shell: `<div className="px-6 py-8 border-b border-zinc-100">` header row, then `<div className="p-6 max-w-6xl mx-auto w-full">` content.
- Loading state: `<div className="py-10 text-center text-sm text-zinc-500">Carregando…</div>`.
- Sidebar + top-header layout is applied via `app/(dashboard)/layout.tsx`. Do not re-wrap pages with their own outer max-width containers.
- Client components only where interactivity is needed. Do not add `"use client"` speculatively.
- Reuse shared types from `packages/types` when a DTO is shared with the API. Do not manually duplicate API response shapes.
- Permission-sensitive UI matches backend authorization. Frontend visibility is not security — backend is source of truth.

## Anti-patterns

- Do not import Drizzle row types directly — consume backend DTOs only.
- Do not fetch inside server components with a browser-only axios instance.
- Do not add heavy client-side dependencies (charting libs, map libs) without discussion.
