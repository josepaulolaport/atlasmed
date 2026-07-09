# packages/ui/AGENTS.md

## Scope

Shared UI primitives, if used across `apps/web` and future React-based mobile client. Verify current usage before adding here — most `apps/web` UI atoms currently live inside `apps/web/components/ui/`.

## Rules

- Only add a component here when at least two apps consume it.
- Component must be styling-token-driven — no `apps/web`-specific palette hardcoding.
- Do not depend on `apps/*`.
- Do not import Radix without verifying the target app already ships it.

## Anti-patterns

- Do not clone `apps/web/components/ui/*` here speculatively.
- Do not create new palette tokens divergent from `apps/web/app/globals.css` — sync them.
