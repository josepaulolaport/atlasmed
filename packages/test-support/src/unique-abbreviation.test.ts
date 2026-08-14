import { describe, expect, test } from "bun:test";
import { uniqueAbbreviation } from "./db-harness";

/**
 * `states.abbreviation` is `char(2)` and UNIQUE, and not every suite in this
 * repo rolls back — the CNES loader's test commits a permanent `ZZ`. A fixture
 * that hardcodes an abbreviation therefore passes or fails depending on what
 * else has ever run against that database, which is the kind of flake nobody
 * can reproduce.
 *
 * The counter is module-global on purpose, so these tests deliberately run
 * uniqueness first and exhaustion last: exhausting it is a one-way door for the
 * rest of the process.
 */
describe("uniqueAbbreviation", () => {
  test("returns distinct two-character values", () => {
    const seen = new Set<string>();
    // One short of the 36 available slots, leaving the throw to the last test.
    for (let i = 0; i < 30; i += 1) {
      const value = uniqueAbbreviation();
      expect(value).toHaveLength(2);
      expect(value).toMatch(/^[A-Z0-9]{2}$/);
      expect(seen.has(value)).toBe(false);
      seen.add(value);
    }
    expect(seen.size).toBe(30);
  });

  test("throws once the slots run out, rather than colliding silently", () => {
    // A silent wrap would hand two fixtures the same abbreviation and fail on a
    // UNIQUE violation far from the cause.
    while (true) {
      try {
        uniqueAbbreviation();
      } catch (error) {
        expect((error as Error).message).toContain("exhausted");
        return;
      }
    }
  });
});
