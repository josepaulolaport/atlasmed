import { log, proxyActivities, workflowInfo } from "@temporalio/workflow";
import type { CnesReference } from "@atlasmed/cnes-ingestion";
import type { IngestCnesRegistryOutput } from "../cnes/ingest-cnes-registry";

/**
 * Discovery and bookkeeping are cheap and safely repeatable.
 */
const quick = proxyActivities<typeof import("../activities/index")>({
  startToCloseTimeout: "5 minutes",
  retry: { maximumAttempts: 3 },
});

/**
 * The load itself.
 *
 * `heartbeatTimeout` is what makes a dead worker recoverable: without it a
 * process killed mid-transfer would hold the activity until
 * `startToCloseTimeout` expired, which for a multi-hundred-megabyte read has to
 * be generous.
 *
 * **Five minutes, not two.** A single FTP attempt can legitimately sit silent
 * for its 120 s client timeout, and a failed one then waits up to 30 s before
 * retrying — 150 s of honest silence, which a two-minute window killed as hung.
 * Five minutes clears that with margin and still catches a dead worker long
 * before the two-hour ceiling.
 *
 * Two attempts, not three. A retry restarts the archive read from the beginning
 * — deflate has no resumable mid-stream state — so a third attempt mostly buys
 * another slow failure. The daily schedule is the real retry.
 */
const ingest = proxyActivities<typeof import("../activities/index")>({
  startToCloseTimeout: "2 hours",
  heartbeatTimeout: "5 minutes",
  retry: { maximumAttempts: 2 },
});

/**
 * The fetch: ~725 MB over a single HTTPS stream, measured at 141 s.
 *
 * Three attempts rather than two, because unlike the load this one is worth
 * retrying — it is one sequential transfer with nothing to resume from, and a
 * dropped connection is the ordinary failure. It heartbeats per chunk, so five
 * minutes of silence still means genuinely stuck.
 */
const fetchArchive = proxyActivities<typeof import("../activities/index")>({
  startToCloseTimeout: "1 hour",
  heartbeatTimeout: "5 minutes",
  retry: { maximumAttempts: 3 },
});

/**
 * Flattens Temporal's failure chain into something worth storing.
 *
 * An activity that throws surfaces here as `ActivityFailure: Activity task
 * failed`, with the real reason nested in `cause`. Writing only the top message
 * to `cnes_runs.error` produces a ledger that records *that* a run failed while
 * withholding *why* — which is the one thing the ledger exists to answer.
 */
function describeFailure(error: unknown): string {
  const messages: string[] = [];
  let current: unknown = error;
  while (current instanceof Error && messages.length < 5) {
    if (current.message) messages.push(current.message);
    current = (current as { cause?: unknown }).cause;
  }
  if (messages.length === 0) return String(error);
  return messages.join(" ← ");
}

export interface CnesIngestionWorkflowInput {
  /** Load this competence instead of discovering the newest. */
  reference?: CnesReference;
  /** Reload a competence already marked COMPLETED. */
  force?: boolean;
}

export type CnesIngestionWorkflowResult =
  | { status: "SKIPPED"; reason: string; reference: string | null }
  | { status: "COMPLETED"; runId: number; result: IngestCnesRegistryOutput };

/**
 * Monthly CNES registry ingestion (ADR 0009).
 *
 * Reads the export straight out of the remote archive by byte range — nothing is
 * downloaded whole, nothing is staged — and records the outcome in
 * `ingestion.cnes_runs` so a failed load is visible without reading logs.
 */
export async function cnesIngestionWorkflow(
  input: CnesIngestionWorkflowInput = {}
): Promise<CnesIngestionWorkflowResult> {
  const workflowId = workflowInfo().workflowId;

  let reference = input.reference;
  if (!reference) {
    const discovered = await quick.discoverCnesReferenceActivity({
      workflowId,
      force: input.force,
    });
    if (!discovered.reference) {
      log.warn("cnes.ingestion.no_archive_published");
      return { status: "SKIPPED", reason: "no archive published", reference: null };
    }
    const label = `${discovered.reference.year}-${String(discovered.reference.month).padStart(2, "0")}`;
    if (discovered.alreadyLoaded) {
      // The expected outcome on most ticks; the export is monthly.
      return { status: "SKIPPED", reason: "already loaded", reference: label };
    }
    reference = discovered.reference;
  }

  const runId = await quick.startCnesRunActivity({ workflowId, reference });

  try {
    /**
     * Fetch and load are separate activities so a failed load never re-fetches.
     * `ensureCnesArchive` is idempotent — object present and verified means it
     * returns at once — so Temporal retrying the load below starts from the
     * bucket rather than from DATASUS (ADR 0010).
     */
    const archive = await fetchArchive.ensureCnesArchiveActivity({
      runId,
      reference,
      force: input.force,
    });
    log.info("cnes.archive.ready", {
      objectKey: archive.objectKey,
      downloaded: archive.downloaded,
      sizeBytes: archive.sizeBytes,
    });

    const result = await ingest.ingestCnesRegistryActivity({
      runId,
      reference,
      objectKey: archive.objectKey,
    });
    const { archiveManifest, ...stats } = result;
    await quick.finishCnesRunActivity({
      runId,
      status: "COMPLETED",
      stats,
      archiveManifest,
    });

    /**
     * Only after the run has promoted, and never in the failure path: a refused
     * or broken run must leave every archive where it is, because the archive is
     * the thing you go and look at when a run goes wrong.
     *
     * Its own step rather than part of finishing, so a storage problem is
     * reported as a storage problem and cannot mark a good load as failed.
     */
    try {
      const pruned = await quick.pruneCnesArchivesActivity({ reference });
      if (pruned.deleted.length > 0) {
        log.info("cnes.archive.pruned", { deleted: pruned.deleted.join(",") });
      }
    } catch (error) {
      log.warn(
        `cnes.archive.prune_failed — the load succeeded; storage will need attention: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    return { status: "COMPLETED", runId, result };
  } catch (error) {
    // Recorded before rethrowing: a run left RUNNING would block its competence
    // behind the partial unique index until something swept it.
    await quick.finishCnesRunActivity({
      runId,
      status: "FAILED",
      error: describeFailure(error),
    });
    throw error;
  }
}
