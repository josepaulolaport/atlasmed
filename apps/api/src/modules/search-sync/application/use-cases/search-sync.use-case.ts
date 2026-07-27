import { z } from "zod";
import { isFullSearchSyncWorkflowId } from "../../../../infrastructure/temporal/temporal.client";
import { ResourceNotFoundError, ValidationError } from "../../../../shared/errors";

export type SearchSyncEntity = "facilities" | "professionals" | "orders";
type SearchSyncTarget = Exclude<SearchSyncEntity, "orders">;
type StartResult = { workflowId: string; runId: string; existing: boolean };

const searchSyncRequestSchema = z.object({
  entity: z.enum(["facilities", "professionals", "orders"]),
}).strict();

export function parseSearchSyncRequest(input: Record<string, unknown>): { entity: SearchSyncEntity } {
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
};

export class StartSearchSyncUseCase {
  constructor(private readonly deps: StartDependencies) {}
  execute(input: { entity: SearchSyncEntity }) {
    return input.entity === "orders"
      ? this.deps.startOrdersBackfill()
      : this.deps.start(input.entity);
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
