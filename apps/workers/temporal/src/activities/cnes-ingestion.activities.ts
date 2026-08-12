import { Context } from "@temporalio/activity";
import { eq, and } from "drizzle-orm";
import { environment } from "@atlasmed/config";
import { cnesRuns } from "@atlasmed/database";
import { listCnesReferences, type CnesReference } from "@atlasmed/cnes-ingestion";
import { db } from "../infrastructure/db";
import {
  failAbandonedCnesRuns,
  finishCnesRun,
  startCnesRun,
} from "../cnes/cnes-run-ops";
import {
  ingestCnesRegistry,
  type IngestCnesRegistryOutput,
} from "../cnes/ingest-cnes-registry";

/** A run still RUNNING after this long is treated as abandoned. */
const ABANDONED_RUN_MS = 6 * 60 * 60 * 1000;

export interface DiscoverCnesReferenceResult {
  reference: CnesReference | null;
  available: number;
  alreadyLoaded: boolean;
}

/**
 * Picks the competence to load: the newest DATASUS publishes that we have not
 * already completed.
 *
 * Returning `alreadyLoaded` rather than throwing keeps the monthly schedule
 * quiet — most ticks find nothing new, and a failed workflow every day would
 * train everyone to ignore the alert that matters.
 */
export async function discoverCnesReferenceActivity(input: {
  workflowId: string;
  force?: boolean;
}): Promise<DiscoverCnesReferenceResult> {
  await failAbandonedCnesRuns({
    olderThanMs: ABANDONED_RUN_MS,
    exceptWorkflowId: input.workflowId,
  });

  const references = await listCnesReferences({
    host: environment.CNES_FTP_HOST,
    directory: environment.CNES_FTP_DIRECTORY,
  });
  const latest = references[0];
  if (!latest) {
    return { reference: null, available: 0, alreadyLoaded: false };
  }

  if (!input.force) {
    const completed = await db
      .select({ id: cnesRuns.id })
      .from(cnesRuns)
      .where(
        and(
          eq(cnesRuns.referenceYear, latest.year),
          eq(cnesRuns.referenceMonth, latest.month),
          eq(cnesRuns.status, "COMPLETED")
        )
      )
      .limit(1);
    if (completed.length > 0) {
      return { reference: latest, available: references.length, alreadyLoaded: true };
    }
  }

  return { reference: latest, available: references.length, alreadyLoaded: false };
}

export async function startCnesRunActivity(input: {
  workflowId: string;
  reference: CnesReference;
}): Promise<number> {
  return startCnesRun({
    temporalWorkflowId: input.workflowId,
    referenceYear: input.reference.year,
    referenceMonth: input.reference.month,
  });
}

export async function ingestCnesRegistryActivity(input: {
  runId: number;
  reference: CnesReference;
}): Promise<IngestCnesRegistryOutput> {
  return ingestCnesRegistry(input, (detail) => Context.current().heartbeat(detail));
}

export async function finishCnesRunActivity(input: {
  runId: number;
  status: "COMPLETED" | "FAILED";
  stats?: Record<string, unknown>;
  archiveManifest?: unknown;
  error?: string;
}): Promise<void> {
  return finishCnesRun(input);
}
