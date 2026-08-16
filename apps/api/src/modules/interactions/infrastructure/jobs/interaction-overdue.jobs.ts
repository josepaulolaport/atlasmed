import type { Worker } from "bullmq";
import { createQueue, createWorker, type JobOptions } from "../../../../infrastructure/jobs/queue.client";
import { logger } from "../../../../infrastructure/logging/logger";
import { interactionUseCases } from "../../composition";

interface OverdueJobData { limit: number }
interface QueueLike { add(name: string, data: OverdueJobData, options: JobOptions & { repeat?: { pattern: string } }): Promise<unknown> }
interface OverdueUseCase { execute(input: { limit: number }): Promise<number> }

const queue = createQueue<OverdueJobData>("interaction-overdue");
let worker: Worker<OverdueJobData> | undefined;

export function createInteractionOverdueJobs(deps: {
  queue: QueueLike;
  createWorker: typeof createWorker<OverdueJobData>;
  useCase: OverdueUseCase;
  closeStale: OverdueUseCase;
}) {
  const process = async (job: { data: OverdueJobData }) => {
    let total = 0;
    let processed: number;
    do {
      processed = await deps.useCase.execute({ limit: job.data.limit });
      total += processed;
    } while (processed > 0);
    logger.info("Processed overdue interactions", { count: total });

    // Spec 0016 §15.6.1 — the last visit of a day has no successor to close it,
    // and a single-destination day has none at all. Run after the overdue pass
    // and in its own try: a visit left open is a nuisance, but letting it fail
    // the whole job would stop scheduled interactions being marked overdue too.
    try {
      let stale = 0;
      let batch: number;
      do {
        batch = await deps.closeStale.execute({ limit: job.data.limit });
        stale += batch;
      } while (batch > 0);
      if (stale > 0) logger.info("Closed stale in-progress visits", { count: stale });
    } catch (error) {
      logger.error("Failed to close stale visits", { err: error });
    }
  };

  return {
    process,
    schedule: () => deps.queue.add("mark-overdue-interactions", { limit: 100 }, {
      attempts: 2,
      backoff: { type: "fixed", delay: 30_000 },
      removeOnComplete: 10,
      removeOnFail: 50,
      repeat: { pattern: "* * * * *" },
    }),
    startWorker: () => deps.createWorker("interaction-overdue", process, { concurrency: 1 }),
  };
}

export const interactionOverdueJobs = createInteractionOverdueJobs({
  queue,
  createWorker,
  useCase: interactionUseCases.markOverdue(),
  closeStale: interactionUseCases.closeStaleVisits(),
});

export function startInteractionOverdueWorker(): void {
  if (worker) return;
  worker = interactionOverdueJobs.startWorker();
}
