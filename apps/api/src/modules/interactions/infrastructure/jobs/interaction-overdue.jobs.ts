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
}) {
  const process = async (job: { data: OverdueJobData }) => {
    let total = 0;
    let processed: number;
    do {
      processed = await deps.useCase.execute({ limit: job.data.limit });
      total += processed;
    } while (processed > 0);
    logger.info("Processed overdue interactions", { count: total });
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
});

export function startInteractionOverdueWorker(): void {
  if (worker) return;
  worker = interactionOverdueJobs.startWorker();
}
