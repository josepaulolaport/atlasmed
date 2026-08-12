import { describe, expect, it } from "bun:test";
import { isPostgresUniqueViolation } from "./postgres-unique-violation";

describe("isPostgresUniqueViolation", () => {
  it("detects code on the error itself", () => {
    expect(isPostgresUniqueViolation({ code: "23505" })).toBe(true);
  });

  it("detects nested cause.code (driver wrap)", () => {
    expect(
      isPostgresUniqueViolation({
        message: "insert failed",
        cause: { code: "23505", detail: "Key already exists" },
      })
    ).toBe(true);
  });

  it("returns false for other codes / shapes", () => {
    expect(isPostgresUniqueViolation({ code: "23503" })).toBe(false);
    expect(isPostgresUniqueViolation(new Error("nope"))).toBe(false);
    expect(isPostgresUniqueViolation(null)).toBe(false);
  });

  it("matches only the named indexes when constraints are given", () => {
    const emailClash = { code: "23505", constraint: "invitations_pending_email_uidx" };
    const tokenClash = { code: "23505", constraint: "invitations_token_hash_unique" };

    expect(isPostgresUniqueViolation(emailClash, ["invitations_pending_email_uidx"])).toBe(true);
    // The insert can collide on token_hash too; that is not a duplicate invite.
    expect(isPostgresUniqueViolation(tokenClash, ["invitations_pending_email_uidx"])).toBe(false);
  });

  it("reads the index name out of detail when the driver omits constraint", () => {
    const viaDetail = {
      code: "23505",
      detail: 'Key (lower(email))=(a@b.c) already exists in index "invitations_pending_email_uidx"',
    };

    expect(isPostgresUniqueViolation(viaDetail, ["invitations_pending_email_uidx"])).toBe(true);
  });
});
