import { describe, expect, it } from "bun:test";
import { CLIENT_STAMP_MAX_AGE_HOURS, resolveClientInstant } from "./client-clock";

const now = new Date("2026-08-15T18:00:00.000Z");
const resolve = (claimed?: string) => resolveClientInstant({ claimed, now, field: "startedAt" });

describe("resolveClientInstant", () => {
  it("believes a stamp from a visit that started before the signal came back", () => {
    // The whole point of §15.6.6-4: the server used to stamp receipt time, so a
    // start queued in a clinic with no signal produced a fictional duration.
    expect(resolve("2026-08-15T17:20:00.000Z").toISOString()).toBe("2026-08-15T17:20:00.000Z");
  });

  it("means now when the client does not say", () => {
    // A client that has not been taught to stamp must behave exactly as before.
    expect(resolve()).toBe(now);
  });

  it("treats a slightly fast clock as skew rather than the future", () => {
    // Accepting it verbatim would let a visit start in the future and fail
    // interactions_actual_ends_after_starts_check on the way out.
    expect(resolve("2026-08-15T18:02:00.000Z")).toEqual(now);
  });

  it("refuses a stamp that is genuinely in the future", () => {
    expect(() => resolve("2026-08-15T19:00:00.000Z")).toThrow();
  });

  it("refuses a stamp older than the queue is allowed to be", () => {
    // Refusing outright is the spec's own alternative to recording a time
    // nobody witnessed. A day-old queue is a different problem.
    const tooOld = new Date(now.getTime() - (CLIENT_STAMP_MAX_AGE_HOURS + 1) * 3_600_000);
    expect(() => resolve(tooOld.toISOString())).toThrow();
  });

  it("refuses something that is not an instant at all", () => {
    expect(() => resolve("ontem de manhã")).toThrow();
  });
});
