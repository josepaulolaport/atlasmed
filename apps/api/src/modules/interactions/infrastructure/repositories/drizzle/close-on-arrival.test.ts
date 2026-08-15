import { describe, expect, it } from "bun:test";
import { inferredCloseAt, visitsClosedByArrival } from "./drizzle-interaction.repository";

const at = new Date("2026-08-15T15:00:00Z");

const visit = (overrides: Partial<{ id: number; modality: string; actualStartedAt: Date | null }> = {}) => ({
  id: 1,
  modality: "IN_PERSON",
  actualStartedAt: new Date("2026-08-15T14:00:00Z"),
  ...overrides,
});

describe("inferredCloseAt", () => {
  it("closes at the end of the rep's workday", () => {
    const closeAt = inferredCloseAt({
      startedAt: new Date("2026-08-15T16:00:00Z"),
      workdayEndsAt: new Date("2026-08-15T21:00:00Z"),
      minimumMinutes: 30,
    });

    expect(closeAt.toISOString()).toBe("2026-08-15T21:00:00.000Z");
  });

  it("never closes a visit before it started", () => {
    // A 19:00 visit against an 18:00 workday would otherwise end before it
    // began, and interactions_actual_ends_after_starts_check rejects that
    // outright — the job would throw once and stop closing anything for
    // anybody (§15.6.6-5). Visits after hours demonstrably happen.
    const startedAt = new Date("2026-08-15T22:00:00Z");

    const closeAt = inferredCloseAt({
      startedAt,
      workdayEndsAt: new Date("2026-08-15T21:00:00Z"),
      minimumMinutes: 30,
    });

    expect(closeAt.getTime()).toBeGreaterThan(startedAt.getTime());
    expect(closeAt.toISOString()).toBe("2026-08-15T22:30:00.000Z");
  });

  it("gives a visit started right on the bell its minimum", () => {
    const startedAt = new Date("2026-08-15T21:00:00Z");

    const closeAt = inferredCloseAt({
      startedAt,
      workdayEndsAt: new Date("2026-08-15T21:00:00Z"),
      minimumMinutes: 30,
    });

    expect(closeAt.toISOString()).toBe("2026-08-15T21:30:00.000Z");
  });
});

describe("visitsClosedByArrival", () => {
  it("closes the visit the rep left open when they arrive somewhere else", () => {
    // A rep's day is a sequence: arriving is proof they left the last place.
    // Requiring a second button press is what leaves the loop empty (§15.6.1).
    const closed = visitsClosedByArrival({
      startingModality: "IN_PERSON",
      open: [visit()],
      at,
    });

    expect(closed).toHaveLength(1);
  });

  it("closes any open visit, whatever the planned order was", () => {
    // Stop 3 then stop 1 is a clinic saying "come at three instead", not a
    // rep misbehaving (§15.6.3).
    const closed = visitsClosedByArrival({
      startingModality: "IN_PERSON",
      open: [visit({ id: 7 })],
      at,
    });

    expect(closed.map((v) => v.id)).toEqual([7]);
  });

  it("a phone call closes nothing", () => {
    // The bug a live run against Postgres caught: the scoping held on the
    // closed side but not the closing side, so a call taken mid-visit silently
    // ended the visit the rep was still sitting in (§15.6.6-6).
    const closed = visitsClosedByArrival({
      startingModality: "REMOTE",
      open: [visit()],
      at,
    });

    expect(closed).toEqual([]);
  });

  it("an open phone call is not closed by arriving at a clinic", () => {
    // Roteirização never proposes calls and only accounts for the time they
    // occupy (§4.4); a call carries its own end.
    const closed = visitsClosedByArrival({
      startingModality: "IN_PERSON",
      open: [visit({ modality: "REMOTE" })],
      at,
    });

    expect(closed).toEqual([]);
  });

  it("leaves a visit open rather than inventing a negative duration", () => {
    // Clock skew or a start replayed out of order. The check constraint would
    // reject it, and the honest answer is the next-morning question (§15.6.6-5).
    const closed = visitsClosedByArrival({
      startingModality: "IN_PERSON",
      open: [visit({ actualStartedAt: new Date("2026-08-15T16:00:00Z") })],
      at,
    });

    expect(closed).toEqual([]);
  });

  it("leaves a visit open when it never recorded a start", () => {
    const closed = visitsClosedByArrival({
      startingModality: "IN_PERSON",
      open: [visit({ actualStartedAt: null })],
      at,
    });

    expect(closed).toEqual([]);
  });
});
