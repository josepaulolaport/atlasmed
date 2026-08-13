import { Context } from "@temporalio/activity";
import { eq, and } from "drizzle-orm";
import { environment } from "@atlasmed/config";
import { cnesRuns } from "@atlasmed/database";
import { listCnesReferences, type CnesReference } from "@atlasmed/cnes-ingestion";
import { db } from "../infrastructure/db";
import { ensureArchive, pruneArchives } from "../cnes/archive-object-store";
import {
  failAbandonedCnesRuns,
  finishCnesRun,
  setCnesRunPhase,
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

  // Over HTTPS, from the listing endpoint the downloads page itself uses. The
  // FTP directory listing is gone with the rest of the FTP reader (ADR 0010).
  const references = await listCnesReferences();
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

/**
 * Puts the archive in the bucket, or confirms it is already there.
 *
 * Its own activity so a failed load never re-fetches: Temporal retries
 * `ingestCnesRegistryActivity` alone, and this one returns immediately because
 * the object is present and verified.
 */
export async function ensureCnesArchiveActivity(input: {
  runId: number;
  reference: CnesReference;
  force?: boolean;
}): Promise<{ objectKey: string; downloaded: boolean; sizeBytes: number }> {
  await setCnesRunPhase({ runId: input.runId, phase: "DOWNLOADING" });
  const result = await ensureArchive({
    reference: input.reference,
    force: input.force,
    heartbeat: (detail) => Context.current().heartbeat(detail),
  });
  return {
    objectKey: result.key,
    downloaded: result.downloaded,
    sizeBytes: result.verification.sizeBytes,
  };
}

export async function ingestCnesRegistryActivity(input: {
  runId: number;
  reference: CnesReference;
  objectKey: string;
}): Promise<IngestCnesRegistryOutput> {
  return ingestCnesRegistry(input, (detail) => Context.current().heartbeat(detail));
}

/**
 * Deletes archives beyond the ones worth keeping.
 *
 * Its own activity, run after the promotion rather than inside the load, so a
 * failed or refused run never deletes anything.
 */
export async function pruneCnesArchivesActivity(input: {
  reference: CnesReference;
}): Promise<{ deleted: string[]; kept: string[] }> {
  const result = await pruneArchives({ protectedReference: input.reference });
  return { deleted: result.deleted, kept: result.kept };
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
