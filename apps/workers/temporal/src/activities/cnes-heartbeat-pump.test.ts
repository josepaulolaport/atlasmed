import { describe, expect, test } from "bun:test";
import { withHeartbeatPump } from "./cnes-ingestion.activities";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The failure this exists to prevent: on 2026-08-14 the CNES load spent minutes
 * staging national workload rows without reporting, Temporal timed the activity
 * out as a dead worker, and the retry restarted the load and reached the same
 * silence — so one slow step consumed both attempts and no competence loaded.
 *
 * Intervals here are milliseconds so the test states the property rather than
 * waiting on the real 30 s.
 */
describe("withHeartbeatPump", () => {
  test("heartbeats through work that reports nothing at all", async () => {
    const beats: unknown[] = [];

    await withHeartbeatPump({
      heartbeat: (detail) => beats.push(detail),
      initial: { step: "starting" },
      intervalMs: 10,
      // The shape of the old bug: busy, alive, and completely silent.
      work: async () => sleep(120),
    });

    expect(beats.length).toBeGreaterThanOrEqual(3);
    // Nothing reported, so every beat carries the initial detail.
    expect(beats.every((b) => (b as { step: string }).step === "starting")).toBe(true);
  });

  test("carries the most recent report once work does say something", async () => {
    const beats: unknown[] = [];

    await withHeartbeatPump({
      heartbeat: (detail) => beats.push(detail),
      initial: { step: "starting" },
      intervalMs: 10,
      work: async (report) => {
        report({ step: "staging workload" });
        await sleep(80);
      },
    });

    // The report beats immediately, and the timer keeps repeating it after.
    expect(beats[0]).toEqual({ step: "staging workload" });
    expect(beats.at(-1)).toEqual({ step: "staging workload" });
  });

  test("stops the timer when the work finishes", async () => {
    const beats: unknown[] = [];

    await withHeartbeatPump({
      heartbeat: (detail) => beats.push(detail),
      initial: { step: "starting" },
      intervalMs: 10,
      work: async () => sleep(30),
    });

    const afterReturn = beats.length;
    await sleep(60);
    expect(beats.length).toBe(afterReturn);
  });

  test("stops the timer when the work throws", async () => {
    const beats: unknown[] = [];

    await expect(
      withHeartbeatPump({
        heartbeat: (detail) => beats.push(detail),
        initial: { step: "starting" },
        intervalMs: 10,
        work: async () => {
          await sleep(30);
          throw new Error("load failed");
        },
      })
    ).rejects.toThrow("load failed");

    const afterThrow = beats.length;
    await sleep(60);
    expect(beats.length).toBe(afterThrow);
  });

  test("a failing heartbeat never takes the load down with it", async () => {
    // Temporal throws if the activity is already closing; that must not surface
    // as a load failure.
    const result = await withHeartbeatPump({
      heartbeat: () => {
        throw new Error("activity is already complete");
      },
      initial: { step: "starting" },
      intervalMs: 10,
      work: async () => {
        await sleep(40);
        return "loaded";
      },
    });

    expect(result).toBe("loaded");
  });
});
