import { Queue, Worker, QueueEvents } from "bullmq";
import { redis } from "../cache/redis.client";

export interface JobOptions {
  attempts?: number;
  backoff?: {
    type: "exponential" | "fixed";
    delay: number;
  };
  removeOnComplete?: boolean | number;
  removeOnFail?: boolean | number;
}

export const connection = {
  host: redis.options.host,
  port: redis.options.port || 6379,
};

export function createQueue<T = any>(name: string): Queue<T> {
  return new Queue<T>(name, { connection });
}

export function createWorker<T = any>(
  name: string,
  processor: (job: { data: T }) => Promise<void>,
  options?: { concurrency?: number }
) {
  return new Worker(
    name,
    async (job) => {
      await processor(job);
    },
    {
      connection,
      concurrency: options?.concurrency || 1,
    }
  );
}

export function createQueueEvents(name: string): QueueEvents {
  return new QueueEvents(name, { connection });
}
