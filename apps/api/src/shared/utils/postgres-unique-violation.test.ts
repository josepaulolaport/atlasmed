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
});
