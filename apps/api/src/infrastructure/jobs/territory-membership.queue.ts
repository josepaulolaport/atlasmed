import { createQueue, createWorker, type JobOptions } from "./queue.client";
import { ConfigurationError } from "../../shared/errors";
import type { Worker } from "bullmq";

export interface TerritoryMembershipJob {
  territoryId?: number;
  facilityIds?: number[];
  /**
   * `search_sync` carries clinics whose derived membership has *already* been
   * rewritten — by the set-based recompute inside the boundary transaction — and
   * only needs the search index caught up. It exists so that path does not have
   * to re-run the geo matching per clinic just to reach the Meili upsert.
   */
  reason: "boundary_change" | "manual_recompute" | "clinic_update" | "search_sync";
}

const queue = createQueue<TerritoryMembershipJob>("territory-membership");

const defaultJobOptions: JobOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 5000 },
  removeOnComplete: 20,
  removeOnFail: 50,
};

type MembershipHandler = (job: TerritoryMembershipJob) => Promise<void>;

export class TerritoryMembershipQueue {
  private handler: MembershipHandler | null = null;
  private worker: Worker<TerritoryMembershipJob> | null = null;

  registerHandler(handler: MembershipHandler): void {
    this.handler = handler;
    if (this.worker) {
      return;
    }

    this.worker = createWorker<TerritoryMembershipJob>("territory-membership", async (job) => {
      if (!this.handler) {
        throw new ConfigurationError("Territory membership handler not registered");
      }
      await this.handler(job.data);
    });
  }

  async enqueue(job: TerritoryMembershipJob): Promise<void> {
    await queue.add("recompute-membership", job, defaultJobOptions);
  }
}

export const territoryMembershipQueue = new TerritoryMembershipQueue();
