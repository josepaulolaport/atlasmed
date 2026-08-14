import { proxyActivities } from "@temporalio/workflow";
import type { CadastroSweepReport } from "../cadastro/sweep-cadastro-uploads";

const activities = proxyActivities<typeof import("../activities/index")>({
  startToCloseTimeout: "10 minutes",
  // The sweep is idempotent — it re-reads state from the database and the store
  // on every attempt, so a retry after a partial run simply finds less to do.
  retry: { maximumAttempts: 3 },
});

/**
 * Scheduled reconciliation of cadastro uploads (ADR 0008 §2).
 *
 * A schedule rather than a per-file workflow: there is nothing to do per file
 * any more, and orphan reconciliation is by nature a sweep over everything that
 * stalled. An in-process `setInterval` was rejected — it runs once per replica,
 * dies silently with the process, and leaves no run history.
 */
export async function cadastroSweepWorkflow(): Promise<CadastroSweepReport> {
  return activities.sweepCadastroUploadsActivity();
}
