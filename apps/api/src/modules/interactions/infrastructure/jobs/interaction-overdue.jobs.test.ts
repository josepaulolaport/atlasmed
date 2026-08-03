import { describe, expect, it, mock } from "bun:test";
import { createInteractionOverdueJobs } from "./interaction-overdue.jobs";

describe("interaction overdue jobs", () => {
  it("registers an every-minute repeatable job and drains bounded batches", async () => {
    const add = mock(async () => undefined);
    const execute = mock(async () => 0);
    const jobs = createInteractionOverdueJobs({ queue: { add }, createWorker: () => ({}) as never, useCase: { execute } });

    await jobs.schedule();
    expect(add).toHaveBeenCalledWith("mark-overdue-interactions", { limit: 100 }, expect.objectContaining({ repeat: { pattern: "* * * * *" } }));

    await jobs.process({ data: { limit: 100 } });
    expect(execute).toHaveBeenCalledWith({ limit: 100 });
  });
});
