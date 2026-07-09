---
name: web-dev-setup
category: procedure
scope: web
description: Boot the Next.js web app for local development. Prereqs, install, env vars, dev/build/start commands. Extracted from apps/web/README.md.
appliesTo:
  concerns: [configuration]
autoAttach: manual
combinesWith: [keep-docs-current]
conflictsWith: []
---

## Attach when
- First-time setup of `apps/web` on a new machine.
- Task changes the dev environment shape (env vars, ports, backing services).

## Prerequisites
- Bun runtime installed.
- Backend API running at `http://localhost:3000` (see `apps/api` for how to start it).

## Setup

```bash
cd apps/web
bun install
```

## Environment

Create `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=AtlasMed
```

Additional variables — see `apps/web/.env.local.example` for the current full list; only the ones above are required for local dev.

## Commands

| Command | Purpose |
|---|---|
| `bun dev` | Dev server (`http://localhost:3000`) |
| `bun run build` | Production build |
| `bun start` | Serve production build |
| `bun run lint` | ESLint |

## Ports

Both the API and web dev server default to `3000`. If you run both locally:

- Start the API on `3000` first.
- Point `NEXT_PUBLIC_API_URL` there.
- Start the web app with a different port: `PORT=3001 bun dev`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| CORS errors from API | Ensure `NEXT_PUBLIC_API_URL` matches API host + port and the API allows the web origin. |
| 401 on every request | API cookie/session not set — sign in through the login page first; if using SSR, ensure cookies forward. |
| `iconify-icon is not defined` warnings during hydration | Web component takes a tick to register — ignore in dev; add `suppressHydrationWarning` only if it surfaces in prod build. |

## Rules

- Do NOT commit `.env.local`.
- Do NOT hardcode the API URL in code — always go through `NEXT_PUBLIC_API_URL`.
- Do NOT default `NEXT_PUBLIC_API_URL` in production builds — CI must inject it explicitly.

## Docs to update after

- `apps/web/README.md` — trim to a pointer + link to this skill.
- `apps/web/.env.local.example` — if new required env vars are introduced.
