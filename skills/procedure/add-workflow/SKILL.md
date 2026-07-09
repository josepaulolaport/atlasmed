---
name: add-workflow
category: procedure
scope: workers
description: Add or change a Temporal workflow in apps/workers. AtlasMed pattern uses per-package worker (worker.ts + workflows/*.workflow.ts + activities/*.activities.ts), proxyActivities with startToCloseTimeout + retry.maximumAttempts, and stable workflow IDs.
appliesTo:
  concerns: [background-jobs, business-logic, data-pipeline]
autoAttach: manual
combinesWith: [check-permissions, keep-docs-current]
conflictsWith: []
---

## Attach when
- Task adds a new workflow file under `apps/workers/<package>/src/workflows/*.workflow.ts`.
- Task changes an existing workflow that may already be running in production.
- Task adds a new activity used by a workflow.

## Load in addition
- `apps/workers/AGENTS.md`
- Nearest existing workflow as a shape reference (e.g. `apps/workers/cnes-ingestion/src/workflows/cnes-monthly-ingestion.workflow.ts`).
- Nearest `worker.ts` bootstrap file.

## Do (max 10 steps)

1. **Locate the target worker package.** Each worker lives at `apps/workers/<name>/` with:
   ```
   <name>/
     src/
       workflows/
         <workflow>.workflow.ts
         types.ts                 # shared workflow input/output types
       activities/
         <phase>.activities.ts
         index.ts                 # re-exports every activity
       infrastructure/            # adapters, external clients
       config.ts                  # env parsing via loadWorkerConfig()
       worker.ts                  # NativeConnection + Worker.create + run
       <name>-worker.integration.test.ts
     package.json
     Dockerfile.dev
   ```

2. **Define workflow input/output in `types.ts`.** All workflow arguments and return values are typed and serializable. No functions, dates as ISO strings only.

3. **Create the workflow file.** One workflow per file, named `<name>.workflow.ts`. Skeleton:
   ```ts
   import { proxyActivities } from "@temporalio/workflow";
   import type { WorkflowInput, WorkflowResult } from "./types";

   const activities = proxyActivities<typeof import("../activities/index")>({
     startToCloseTimeout: "120 minutes",
     retry: { maximumAttempts: 3 },
   });

   export async function myWorkflow(input: WorkflowInput): Promise<WorkflowResult> {
     const step1 = await activities.doSomethingActivity({ ingestionRunId: input.ingestionRunId, ... });
     const step2 = await activities.doNextActivity({ ... });
     return { workflowId: workflowIdFor(input), stats: { step1, step2 } };
   }
   ```
   Set `startToCloseTimeout` and `retry.maximumAttempts` explicitly — never rely on defaults.

4. **Add activities in `src/activities/<phase>.activities.ts`.** Activities are:
   - Idempotent — safe to retry.
   - Handle their own I/O (DB, HTTP, file). Workflows never touch I/O.
   - Typed inputs + typed returns.
   - Registered in `activities/index.ts` re-exports.

5. **Stable workflow IDs.** Derive from business keys, not timestamps:
   ```ts
   function workflowIdForReference(ano: number, mes: number): string {
     return `cnes-ingestion-${ano}-${String(mes).padStart(2, "0")}`;
   }
   ```
   Same input → same ID → dedupe at Temporal.

6. **Emit audit events at start / success / fail.** Use the audit-event emitter (not the generic logger). See registry-ingestion pattern in `apps/api/src/modules/registry-ingestion/`.

7. **Version changes to running workflows.** Use `patched('feature-flag', ...)` from `@temporalio/workflow` when altering behavior that could hit in-flight executions. Never silently mutate.

8. **Register the workflow in the worker.** `worker.ts` uses `NativeConnection.connect` + `Worker.create({ workflowsPath, activities, taskQueue })`. Workflows are auto-discovered from `workflowsPath`; activities from the imported module. Add a new activity → re-export it from `activities/index.ts`. Add a new workflow → nothing to wire (auto-discovered), but confirm the file is under `workflows/`.

9. **Task queue naming.** Per package, in `config.ts`. Do not share task queues across workers.

10. **Integration test.** `<name>-worker.integration.test.ts` boots a test worker and executes the workflow against fakes/adapters. See `cnes-ingestion-worker.integration.test.ts` as reference.

## Rules (non-negotiable)

- No direct external calls from workflow code — all I/O behind activities.
- No `Date.now()` / `Math.random()` in workflow body — Temporal replay will produce different values. Use activities or `workflowInfo`.
- No in-memory state that must survive process restart — Temporal replay only re-runs deterministic workflow code.
- `startToCloseTimeout` and `retry.maximumAttempts` set explicitly on every `proxyActivities` call.
- Workflow IDs derived from business keys, not timestamps.
- Activities are idempotent — no unguarded "create-only" side effects.
- Do not import `@temporalio/worker` from workflow code — only from `worker.ts`.
- Temporal SDK stays scoped to `apps/workers` and (when necessary) `packages/cnes-ingestion`.

## Docs to update after

- `apps/workers/AGENTS.md` — if a new pattern was introduced.
- `docs/architecture/features/<feature>.md` — if the workflow implements a tracked feature.
- Relevant `docs/specs/*/design.md` — if the workflow fulfills a spec step.
