/**
 * One-shot Temporal start for Emultec order import (ops / backfill).
 *
 * Env: TEMPORAL_* (+ worker config). Worker must be running with EMULTEC_MYSQL_* + Docker.
 *
 * Usage:
 *   bun src/scripts/start-emultec-order-import.ts
 *   bun src/scripts/start-emultec-order-import.ts --mode=BACKFILL
 *   bun src/scripts/start-emultec-order-import.ts --mode=HYBRID --reconcile-days=14
 */
import { Client, Connection, WorkflowExecutionAlreadyStartedError } from "@temporalio/client";
import { loadWorkerConfig } from "../config";
import { logger } from "../logger";
import type { EmultecOrderImportWorkflowInput } from "../workflows/emultec-order-import.workflow";

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function parseNumber(name: string, fallback: number): number {
  const raw = argValue(name);
  if (raw == null) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function buildInput(): EmultecOrderImportWorkflowInput {
  const mode = (argValue("mode") ?? "HYBRID").toUpperCase() as NonNullable<
    EmultecOrderImportWorkflowInput["mode"]
  >;
  const input: EmultecOrderImportWorkflowInput = {
    mode,
    pageSize: parseNumber("page-size", 200),
    reconcileDays: parseNumber("reconcile-days", 30),
    triggerPurchaseRecurrence: argValue("no-recurrence") == null,
  };
  const afterId = argValue("after-id");
  if (afterId != null && Number.isFinite(Number(afterId))) {
    input.afterId = Number(afterId);
  }
  const since = argValue("since");
  if (since) input.sinceDate = since;
  const maxPages = argValue("max-pages");
  if (maxPages != null && Number.isFinite(Number(maxPages))) {
    input.maxPages = Number(maxPages);
  }
  return input;
}

function workflowIdFor(mode: string): string {
  if (mode === "BACKFILL") return "emultec-order-import-backfill";
  if (mode === "RECONCILE") return "emultec-order-import-reconcile";
  if (mode === "INCREMENTAL") return "emultec-order-import-incremental";
  return "emultec-order-import-hybrid";
}

async function main(): Promise<void> {
  const config = loadWorkerConfig();
  const input = buildInput();
  const mode = input.mode ?? "HYBRID";
  const workflowId = workflowIdFor(mode);

  const connection = await Connection.connect({ address: config.temporalAddress });
  try {
    const client = new Client({
      connection,
      namespace: config.temporalNamespace,
    });
    try {
      const handle = await client.workflow.start("emultecOrderImportWorkflow", {
        taskQueue: config.taskQueue,
        workflowId,
        args: [input],
      });
      logger.info("emultec.order_import.workflow_started", {
        workflowId,
        runId: handle.firstExecutionRunId,
        mode,
      });
      console.log(JSON.stringify({ workflowId, runId: handle.firstExecutionRunId, existing: false, input }));
    } catch (error) {
      if (error instanceof WorkflowExecutionAlreadyStartedError) {
        const description = await client.workflow.getHandle(workflowId).describe();
        logger.info("emultec.order_import.workflow_already_running", {
          workflowId,
          runId: description.runId,
        });
        console.log(
          JSON.stringify({
            workflowId,
            runId: description.runId,
            existing: true,
            input,
          })
        );
        return;
      }
      throw error;
    }
  } finally {
    await connection.close();
  }
}

if (import.meta.main) {
  main().catch((error) => {
    logger.error("emultec.order_import.start_failed", error);
    process.exit(1);
  });
}
