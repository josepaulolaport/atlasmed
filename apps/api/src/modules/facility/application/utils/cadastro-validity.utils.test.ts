import { describe, expect, it } from "bun:test";
import {
  EXPIRY_WARNING_DAYS,
  daysUntil,
  deriveExpiry,
  isValidIsoDate,
} from "./cadastro-validity.utils";

/**
 * The expiry warning is derived, never stored (ADR 0008 §4). These are the whole
 * rule, so they are asserted rather than assumed — a boundary error here shows a
 * rep the wrong badge on a compliance document and nothing else complains.
 */
const TODAY = new Date("2026-08-11T15:30:00.000Z");

describe("deriving a cadastro expiry", () => {
  it("has nothing to say about a document with no validity", () => {
    // Null is "the question does not apply", not "fine" — most requirements
    // declare no validity at all.
    expect(deriveExpiry(null, TODAY)).toBeNull();
    expect(deriveExpiry(undefined, TODAY)).toBeNull();
  });

  it("counts whole calendar days, ignoring the time of day", () => {
    // A validity is a calendar fact. Comparing it to a timestamp would make the
    // answer depend on when in the day the request landed, so 15:30 must give
    // the same count as 00:01.
    expect(daysUntil("2026-08-12", TODAY)).toBe(1);
    expect(daysUntil("2026-08-12", new Date("2026-08-11T00:01:00.000Z"))).toBe(1);
    expect(daysUntil("2026-08-12", new Date("2026-08-11T23:59:00.000Z"))).toBe(1);
  });

  it("treats the expiry day itself as not yet expired", () => {
    const today = deriveExpiry("2026-08-11", TODAY);
    expect(today).toMatchObject({ daysRemaining: 0, status: "EXPIRING_SOON" });
  });

  it("marks yesterday as expired", () => {
    expect(deriveExpiry("2026-08-10", TODAY)).toMatchObject({
      daysRemaining: -1,
      status: "EXPIRED",
    });
  });

  it("warns from exactly the threshold, and not a day earlier", () => {
    // The boundary is the whole point of having a constant.
    const atThreshold = deriveExpiry("2026-09-10", TODAY); // +30
    const beyond = deriveExpiry("2026-09-11", TODAY); // +31

    expect(EXPIRY_WARNING_DAYS).toBe(30);
    expect(atThreshold).toMatchObject({ daysRemaining: 30, status: "EXPIRING_SOON" });
    expect(beyond).toMatchObject({ daysRemaining: 31, status: "VALID" });
  });

  it("carries the date through, so the client need not re-parse it", () => {
    expect(deriveExpiry("2027-01-01", TODAY)?.validUntil).toBe("2027-01-01");
  });
});

describe("validating a date the rep typed", () => {
  it("accepts a real calendar date", () => {
    expect(isValidIsoDate("2026-02-28")).toBe(true);
    expect(isValidIsoDate("2028-02-29")).toBe(true); // leap year
  });

  it("rejects a date that looks well-formed but does not exist", () => {
    // `new Date("2026-02-30")` rolls forward to March rather than failing, so a
    // format check alone would let a typo through and store the wrong day.
    expect(isValidIsoDate("2026-02-30")).toBe(false);
    expect(isValidIsoDate("2027-02-29")).toBe(false); // not a leap year
    expect(isValidIsoDate("2026-13-01")).toBe(false);
  });

  it("rejects anything that is not YYYY-MM-DD", () => {
    expect(isValidIsoDate("11/08/2026")).toBe(false);
    expect(isValidIsoDate("2026-8-1")).toBe(false);
    expect(isValidIsoDate("2026-08-11T00:00:00Z")).toBe(false);
    expect(isValidIsoDate("")).toBe(false);
  });
});
