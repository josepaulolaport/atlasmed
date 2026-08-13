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
    // answer depend on when in the day the request landed, so any moment on the
    // 11th must give the same count. The instants are the first and last minute
    // of the 11th *in Brazil* — 00:01 and 23:59 UTC are the 10th and the 11th
    // there, which is a different question.
    expect(daysUntil("2026-08-12", TODAY)).toBe(1);
    expect(daysUntil("2026-08-12", new Date("2026-08-11T03:01:00.000Z"))).toBe(1);
    expect(daysUntil("2026-08-12", new Date("2026-08-12T02:59:00.000Z"))).toBe(1);
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

  describe("the day is the one the rep is standing in", () => {
    // America/Sao_Paulo is UTC-3, so the last three hours of every Brazilian day
    // are already tomorrow in UTC. Reading "today" off the server's UTC clock
    // aged every document by a day for that window — a rep filing paperwork at
    // 21:00 saw a licence valid until today flagged EXPIRED.
    const EVENING_IN_BRAZIL = new Date("2026-08-12T01:00:00.000Z"); // 22:00 on the 11th

    it("still calls the 11th today at 22:00 in Brazil", () => {
      expect(deriveExpiry("2026-08-11", EVENING_IN_BRAZIL)).toMatchObject({
        daysRemaining: 0,
        status: "EXPIRING_SOON",
      });
    });

    it("gives the same answer at 22:00 as it did that morning", () => {
      const morning = new Date("2026-08-11T12:00:00.000Z");
      expect(daysUntil("2026-09-01", EVENING_IN_BRAZIL)).toBe(
        daysUntil("2026-09-01", morning)
      );
    });

    it("rolls over at Brazilian midnight, not UTC midnight", () => {
      // 00:30 on the 12th local — now the 11th really is yesterday.
      const afterMidnight = new Date("2026-08-12T03:30:00.000Z");
      expect(deriveExpiry("2026-08-11", afterMidnight)).toMatchObject({
        daysRemaining: -1,
        status: "EXPIRED",
      });
    });
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
