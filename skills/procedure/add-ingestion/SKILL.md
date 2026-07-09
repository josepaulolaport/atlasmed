---
name: add-ingestion
category: procedure
scope: shared-package
description: Add or change a data pipeline / ingestion adapter under packages/cnes-ingestion (or a sibling ingestion package). Ports + adapters pattern, pure parsing, side effects behind interfaces.
appliesTo:
  concerns: [data-pipeline, integration, persistence]
autoAttach: manual
combinesWith: [add-tests, keep-docs-current, add-observability]
conflictsWith: []
---

## Attach when
- Task adds a new source adapter (FTP, S3, HTTP, batch file).
- Task changes parsing logic for an existing source.
- Task adds a new archive storage target.

## Do
1. Adapters implement a port. New sources add an adapter, not a new consumer.
2. Parsing is pure. Storage and network live behind adapters. This keeps parse tests fast.
3. Timeouts are explicit — never rely on client defaults.
4. Factory functions build the adapter; no side effects on import.
5. If new persistent state is needed, chain to `procedure/add-migration`.
6. If workflow orchestration is needed, chain to `procedure/add-workflow`.

## Rules
- No secret reads from `process.env` inside functions — pass config explicitly via factory.
- No Temporal SDK imports here — orchestration lives in `apps/workers`.
- Emit structured audit events at ingestion boundaries.

## Docs to update after
- `packages/cnes-ingestion/AGENTS.md` — if a new adapter pattern was introduced.
- `docs/architecture/features/clinic-doctor-registry.md` — if the CNES pipeline surface changed.
