/**
 * One-shot Temporal start for the metric snapshot backfill (spec 0013 §4.4).
 *
 * The backfill is the reconciliation sweep run over an explicit month range —
 * same workflow, mode BACKFILL, months supplied here instead of derived from the
 * clock.
 *
 * The range is mandatory. A backfill that defaults to "everything" recomputes
 * ~14k profiles across every month anyone ever ordered in, on a database whose
 * only defence is that nobody typed the command; the operator says which months
 * they mean, or nothing runs.
 *
 * Env: TEMPORAL_* (+ worker config). Worker must be running.
 *
 * Usage:
 *   bun src/scripts/start-metric-snapshot-backfill.ts --from=2026-01-01 --to=2026-03-01
 */
import { Client, Connection, WorkflowExecutionAlreadyStartedError } from "@temporalio/client";
import { addMonths, type MonthKey } from "@atlasmed/facility-insights";
import { loadWorkerConfig } from "../config";
import { logger } from "../logger";
import type { MetricSnapshotWorkflowInput } from "../workflows/metric-snapshot.workflow";

const MONTH_KEY = /^(\d{4})-(\d{2})-01$/;

export class MetricSnapshotBackfillArgumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetricSnapshotBackfillArgumentError";
  }
}

function argValue(argv: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

/**
 * Months are stored as the first day of the month (`facility_metric_snapshots.month`),
 * so a mid-month date is not "close enough" — it would name a month key that no
 * row can ever match.
 */
function parseMonth(name: string, raw: string | undefined): MonthKey {
  if (raw == null || raw === "") {
    throw new MetricSnapshotBackfillArgumentError(
      `--${name} is required, as YYYY-MM-01 (a backfill never defaults to every month)`,
    );
  }
  const match = MONTH_KEY.exec(raw);
  if (!match) {
    throw new MetricSnapshotBackfillArgumentError(
      `--${name} must be the first day of a month as YYYY-MM-01, got "${raw}"`,
    );
  }
  const monthOfYear = Number(match[2]);
  if (monthOfYear < 1 || monthOfYear > 12) {
    throw new MetricSnapshotBackfillArgumentError(
      `--${name} has an impossible month, got "${raw}"`,
    );
  }
  return raw;
}

export interface MetricSnapshotBackfillRange {
  from: MonthKey;
  to: MonthKey;
}

export function parseBackfillRange(argv: string[]): MetricSnapshotBackfillRange {
  const from = parseMonth("from", argValue(argv, "from"));
  const to = parseMonth("to", argValue(argv, "to"));

  // Lexicographic comparison is exact for zero-padded YYYY-MM-01.
  if (from > to) {
    throw new MetricSnapshotBackfillArgumentError(
      `--from must not be after --to, got ${from} > ${to}`,
    );
  }

  return { from, to };
}

/** Inclusive on both ends: `--from=X --to=X` backfills exactly month X. */
export function expandMonths(range: MetricSnapshotBackfillRange): MonthKey[] {
  const months: MonthKey[] = [];
  let month = range.from;
  while (month <= range.to) {
    months.push(month);
    month = addMonths(month, 1);
  }
  return months;
}

export function metricSnapshotBackfillWorkflowId(range: MetricSnapshotBackfillRange): string {
  return `metric-snapshot-backfill-${range.from}-${range.to}`;
}

export function buildBackfillInput(argv: string[]): {
  range: MetricSnapshotBackfillRange;
  workflowId: string;
  input: MetricSnapshotWorkflowInput;
} {
  const range = parseBackfillRange(argv);
  return {
    range,
    workflowId: metricSnapshotBackfillWorkflowId(range),
    input: { mode: "BACKFILL", months: expandMonths(range) },
  };
}

async function main(): Promise<void> {
  const config = loadWorkerConfig();
  const { input, workflowId } = buildBackfillInput(process.argv.slice(2));

  const connection = await Connection.connect({ address: config.temporalAddress });
  try {
    const client = new Client({ connection, namespace: config.temporalNamespace });
    try {
      const handle = await client.workflow.start("metricSnapshotWorkflow", {
        taskQueue: config.taskQueue,
        workflowId,
        args: [input],
      });
      logger.info("facility_metric_snapshot.backfill_workflow_started", {
        workflowId,
        runId: handle.firstExecutionRunId,
        monthCount: input.months?.length ?? 0,
      });
      console.log(
        JSON.stringify({
          workflowId,
          runId: handle.firstExecutionRunId,
          existing: false,
          input,
        }),
      );
    } catch (error) {
      if (error instanceof WorkflowExecutionAlreadyStartedError) {
        // Same range already running: report it rather than starting a second
        // identical sweep over the same months.
        const description = await client.workflow.getHandle(workflowId).describe();
        logger.info("facility_metric_snapshot.backfill_workflow_already_running", {
          workflowId,
          runId: description.runId,
        });
        console.log(
          JSON.stringify({ workflowId, runId: description.runId, existing: true, input }),
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
    logger.error("facility_metric_snapshot.backfill_start_failed", error);
    process.exit(1);
  });
}
