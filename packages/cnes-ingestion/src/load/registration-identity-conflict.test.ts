import { describe, expect, test } from "bun:test";
import { isRegistrationIdentityConflict } from "./load-registry";

const IDENTITY_CONSTRAINT = "registry_professional_registrations_council_state_number_key";

/**
 * Shaped like what drizzle 0.45 actually throws: the driver's `PostgresError`,
 * carrying `code` and `constraint_name`, hung off the `cause` of a
 * `DrizzleQueryError` whose own message is just the failed SQL.
 */
function drizzleWrapped(constraint: string, code = "23505"): Error {
  const driver = Object.assign(new Error("duplicate key value violates unique constraint"), {
    code,
    constraint_name: constraint,
  });
  return Object.assign(new Error("Failed query: insert into ..."), { cause: driver });
}

/**
 * On 2026-08-14 this returned false for a wrapped conflict, so the insert
 * rethrew and killed the load on the one violation it is designed to absorb —
 * two SUS ids claiming the same (council, UF, number). `registrationsConflicted`
 * read zero throughout, which is what made it look like the case never arose.
 */
describe("isRegistrationIdentityConflict", () => {
  test("sees the identity conflict through drizzle's wrapper", () => {
    expect(isRegistrationIdentityConflict(drizzleWrapped(IDENTITY_CONSTRAINT))).toBe(true);
  });

  test("still sees an unwrapped driver error", () => {
    const bare = Object.assign(new Error("duplicate key"), {
      code: "23505",
      constraint_name: IDENTITY_CONSTRAINT,
    });
    expect(isRegistrationIdentityConflict(bare)).toBe(true);
  });

  /**
   * The upsert targets `(professional, council, UF)`, so a 23505 naming that
   * constraint means the conflict target is broken. Absorbing it would hide a
   * real defect behind a plausible-looking counter.
   */
  test("refuses a different constraint carrying the same SQLSTATE", () => {
    expect(
      isRegistrationIdentityConflict(
        drizzleWrapped("registry_professional_registrations_professional_council_state_key")
      )
    ).toBe(false);
  });

  test("refuses the right constraint under a different SQLSTATE", () => {
    expect(isRegistrationIdentityConflict(drizzleWrapped(IDENTITY_CONSTRAINT, "23514"))).toBe(
      false
    );
  });

  test("refuses ordinary failures a load must not launder into a conflict count", () => {
    expect(isRegistrationIdentityConflict(new Error("connection terminated"))).toBe(false);
    expect(isRegistrationIdentityConflict(null)).toBe(false);
    expect(isRegistrationIdentityConflict(undefined)).toBe(false);
  });

  test("terminates on a self-referencing cause chain", () => {
    const looped = new Error("Failed query") as Error & { cause?: unknown };
    looped.cause = looped;
    expect(isRegistrationIdentityConflict(looped)).toBe(false);
  });
});
