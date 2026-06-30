import { createQueue, createWorker, type JobOptions } from "./queue.client";

export interface TerritoryMembershipJob {
  territoryId?: string;
  facilityIds?: string[];
  reason: "boundary_change" | "manual_recompute" | "clinic_update";
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

  registerHandler(handler: MembershipHandler): void {
    this.handler = handler;

    createWorker<TerritoryMembershipJob>("territory-membership", async (job) => {
      if (!this.handler) {
        throw new Error("Territory membership handler not registered");
      }
      await this.handler(job.data);
    });
  }

  async enqueue(job: TerritoryMembershipJob): Promise<void> {
    await queue.add("recompute-membership", job, defaultJobOptions);
  }
}

export const territoryMembershipQueue = new TerritoryMembershipQueue();
