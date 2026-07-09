# packages/cnes-ingestion/AGENTS.md

## Scope

CNES / DataSUS ingestion adapters and utilities: FTP clients, ZIP file mapping, parsing helpers, archive storage, workflow-id helpers.

## Rules

- Adapters implement a port. New sources add an adapter, not new consumers.
- No side effects on import — factory functions build the adapter.
- Parsing is pure. Storage/network is behind adapters. This keeps parse tests fast.
- FTP timeouts are explicit — never rely on client defaults.

## Required docs by task

| Task | Load |
|---|---|
| Any change here | this file, `docs/architecture/features/clinic-doctor-registry.md` |
| Workflow orchestration | `apps/workers/AGENTS.md` |
| Persistence | `packages/database/AGENTS.md` |

## Anti-patterns

- Do not import Temporal SDK code — orchestration lives in `apps/workers`.
- Do not read secrets from `process.env` inside functions; pass configuration explicitly.
