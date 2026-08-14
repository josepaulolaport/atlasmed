import { Context } from "@temporalio/activity";
import { eq, and } from "drizzle-orm";
import { environment } from "@atlasmed/config";
import { cnesRuns } from "@atlasmed/database";
import {
  listCnesReferences,
  pruneCnesStaging,
  type CnesReference,
} from "@atlasmed/cnes-ingestion";
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

/**
 * How often the load says it is alive, regardless of what it is doing.
 *
 * Well inside the activity's 5-minute `heartbeatTimeout`, so a worker has to be
 * genuinely gone — not merely busy — before Temporal gives up on it.
 */
const LOAD_HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * Runs `work`, heartbeating on a timer rather than on progress.
 *
 * The load only reported between steps, and its steps are long: staging the
 * national workload rows runs for minutes without reading another byte of the
 * archive. Temporal saw silence, called the worker dead, and killed it — then
 * the retry restarted the load from the top and reached the same silence, so
 * one slow step consumed both attempts and no competence could ever load.
 *
 * Progress-driven heartbeats cannot fix that on their own: they only fire where
 * somebody thought to add them, and the stall was in a stretch nobody had
 * instrumented. A timer is indifferent to what the work is doing, so the only
 * thing that stops it is the process actually dying — which is the condition
 * `heartbeatTimeout` exists to detect.
 *
 * `report` still exists and still heartbeats immediately: the timer keeps the
 * activity alive, the reports say where it got to.
 */
export async function withHeartbeatPump<T>(options: {
  heartbeat: (detail: unknown) => void;
  initial: unknown;
  intervalMs?: number;
  work: (report: (detail: unknown) => void) => Promise<T>;
}): Promise<T> {
  let latest = options.initial;
  const pump = setInterval(() => {
    try {
      options.heartbeat(latest);
    } catch {
      // The activity is already finishing; a heartbeat here is noise, not news.
    }
  }, options.intervalMs ?? LOAD_HEARTBEAT_INTERVAL_MS);

  try {
    return await options.work((detail) => {
      latest = detail;
      options.heartbeat(detail);
    });
  } finally {
    clearInterval(pump);
  }
}

export async function ingestCnesRegistryActivity(input: {
  runId: number;
  reference: CnesReference;
  objectKey: string;
}): Promise<IngestCnesRegistryOutput> {
  return withHeartbeatPump({
    heartbeat: (detail) => Context.current().heartbeat(detail),
    initial: { reference: input.reference, step: "starting" },
    work: (report) => ingestCnesRegistry(input, report),
  });
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

/**
 * Drop staged competências the promotion superseded.
 *
 * Its own activity for the same reason the archive prune is: a storage or
 * database problem while tidying up must be reported as that, and must not turn
 * a good load into a failed one.
 *
 * The scheduled path had no equivalent at all until now — staging grew by ~316 MB
 * every month with nothing ever deleting it. `archive-load.ts` gained a prune
 * first, which left the two entry points disagreeing; both now call the same
 * function in `@atlasmed/cnes-ingestion`.
 */
export async function pruneCnesStagingActivity(input: {
  reference: CnesReference;
}): Promise<{ carga: number; professionals: number }> {
  return pruneCnesStaging({ db, reference: input.reference });
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
