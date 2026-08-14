import { z } from "zod";
import { isFullSearchSyncWorkflowId } from "../../../../infrastructure/temporal/temporal.client";
import { ResourceNotFoundError, ValidationError } from "../../../../shared/errors";

export type SearchSyncEntity =
  | "facilities"
  | "persons"
  | "facility_candidates"
  | "orders"
  | "emultec-orders"
  | "cnes";
/**
 * The three Meilisearch indexes a full rebuild can target.
 *
 * `facility_candidates` is the CNES import list. The monthly load replaces every
 * row of `registry.facilities`, and that index is otherwise only maintained by
 * per-import upserts — so it goes stale once a month unless something rebuilds
 * it. The ingestion workflow does; this is the repair path.
 */
type SearchSyncTarget = "facilities" | "persons" | "facility_candidates";
type StartResult = { workflowId: string; runId: string; existing: boolean };

export interface SearchSyncRequest {
  entity: SearchSyncEntity;
  /**
   * CNES only. Load this competência rather than discovering the newest
   * published — the "reload 2026-07 now" case.
   */
  reference?: { year: number; month: number };
  /** CNES only. Reload a competência the ledger already marks COMPLETED. */
  force?: boolean;
}

/**
 * `cnes` belongs on this endpoint, not on one of its own.
 *
 * This route is already the operations trigger rather than a search one — it
 * starts the Emultec order import and the purchase-recurrence backfill, neither
 * of which is a search. It is ADMIN-only through `manage SEARCH_SYNC`, returns
 * 202 with a workflow id, and has a status endpoint. A separate route for CNES
 * would duplicate all of that to say the same thing.
 */
const searchSyncRequestSchema = z
  .object({
    entity: z.enum([
      "facilities",
      "persons",
      "facility_candidates",
      "orders",
      "emultec-orders",
      "cnes",
    ]),
    reference: z
      .object({
        year: z.number().int().min(2000).max(2100),
        month: z.number().int().min(1).max(12),
      })
      .optional(),
    force: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.entity === "cnes" ||
      (value.reference === undefined && value.force === undefined),
    {
      // Silently ignoring them would let "reload facilities for 2026-07" look
      // accepted while doing something else entirely.
      message: "reference and force apply only to entity 'cnes'",
      path: ["reference"],
    }
  );

export function parseSearchSyncRequest(
  input: Record<string, unknown>
): SearchSyncRequest {
  const parsed = searchSyncRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues.map((issue) => ({
        field: issue.path.join(".") || "body",
        message: issue.message,
      }))
    );
  }
  return parsed.data;
}

type StartDependencies = {
  start: (entity: SearchSyncTarget) => Promise<StartResult>;
  startOrdersBackfill: () => Promise<StartResult>;
  startEmultecOrderImport: () => Promise<StartResult>;
  startCnesIngestion: (input: {
    reference?: { year: number; month: number };
    force?: boolean;
  }) => Promise<StartResult>;
};

export class StartSearchSyncUseCase {
  constructor(private readonly deps: StartDependencies) {}
  execute(input: SearchSyncRequest) {
    if (input.entity === "orders") {
      return this.deps.startOrdersBackfill();
    }
    if (input.entity === "emultec-orders") {
      return this.deps.startEmultecOrderImport();
    }
    if (input.entity === "cnes") {
      return this.deps.startCnesIngestion({
        reference: input.reference,
        force: input.force,
      });
    }
    return this.deps.start(input.entity);
  }
}

type StatusDependencies = {
  describe: (workflowId: string) => Promise<{ workflowId: string; runId: string; status: string }>;
};

export class GetSearchSyncStatusUseCase {
  constructor(private readonly deps: StatusDependencies) {}
  async execute(workflowId: string) {
    if (!isFullSearchSyncWorkflowId(workflowId)) {
      throw new ResourceNotFoundError("SearchSync", workflowId);
    }

    try {
      return await this.deps.describe(workflowId);
    } catch (error) {
      if (error instanceof Error && error.name === "WorkflowNotFoundError") {
        throw new ResourceNotFoundError("SearchSync", workflowId);
      }
      throw error;
    }
  }
}
