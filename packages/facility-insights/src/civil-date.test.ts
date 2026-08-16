import { describe, expect, test } from "bun:test";

import { APPLICATION_TIMEZONE, civilDateAt } from "./index";

describe("civilDateAt", () => {
  test("files the last three hours of a Brazilian day under that day", () => {
    // 22:30 on the 15th in São Paulo is already the 16th in UTC. The funnel used
    // to truncate in UTC and would have called this a purchase on the 16th.
    expect(civilDateAt(new Date("2026-08-16T01:30:00Z"))).toBe("2026-08-15");
  });

  test("agrees with UTC for the rest of the day", () => {
    expect(civilDateAt(new Date("2026-08-15T12:00:00Z"))).toBe("2026-08-15");
    expect(civilDateAt(new Date("2026-08-15T03:00:00Z"))).toBe("2026-08-15");
  });

  test("pads to a strict YYYY-MM-DD the snapshot input accepts", () => {
    expect(civilDateAt(new Date("2026-01-05T15:00:00Z"))).toBe("2026-01-05");
  });

  test("honours an explicit zone", () => {
    expect(civilDateAt(new Date("2026-08-16T01:30:00Z"), "UTC")).toBe("2026-08-16");
  });

  test("names the zone the business works in", () => {
    expect(APPLICATION_TIMEZONE).toBe("America/Sao_Paulo");
  });
});
