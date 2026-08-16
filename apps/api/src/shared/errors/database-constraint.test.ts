import { describe, expect, test } from "bun:test";
import { toDatabaseConstraintError } from "./database-constraint";

/** A driver error, in the shape `postgres` reports one. */
function pgError(fields: { code: string; detail?: string; constraint?: string }) {
  return Object.assign(new Error("db"), fields);
}

describe("toDatabaseConstraintError", () => {
  test("a duplicate is a 409 the caller can act on", () => {
    const error = toDatabaseConstraintError(
      pgError({ code: "23505", constraint: "healthcare_providers_name_uidx" })
    );

    expect(error?.statusCode).toBe(409);
    expect(error?.code).toBe("RESOURCE_CONFLICT");
    // The constraint names our columns; it belongs in the logs, not the reply.
    expect(JSON.stringify(error?.toClientJSON())).not.toContain(
      "healthcare_providers_name_uidx"
    );
  });

  test("a foreign key still pointed at is 409 RESOURCE_IN_USE", () => {
    const error = toDatabaseConstraintError(
      pgError({
        code: "23503",
        detail: 'Key (id)=(10) is still referenced from table "order_items".',
      })
    );

    expect(error?.statusCode).toBe(409);
    expect(error?.code).toBe("RESOURCE_IN_USE");
  });

  test("a foreign key whose target is missing is a 400, not RESOURCE_IN_USE", () => {
    // Same SQLSTATE, opposite meaning. Creating a product with a Linha that
    // does not exist used to answer "cannot be removed while they exist" —
    // which describes a different problem and points at the wrong fix.
    const error = toDatabaseConstraintError(
      pgError({
        code: "23503",
        detail:
          'Key (vertical_id)=(9999) is not present in table "business_verticals".',
      })
    );

    expect(error?.statusCode).toBe(400);
    expect(error?.code).toBe("RESOURCE_NOT_FOUND");
    expect(error?.message).toContain("does not exist");
  });

  test("reads the SQLSTATE through a Drizzle wrapper", () => {
    const wrapped = Object.assign(new Error("drizzle"), {
      cause: pgError({ code: "23502" }),
    });

    expect(toDatabaseConstraintError(wrapped)?.statusCode).toBe(400);
  });

  test("anything else stays ours to fix", () => {
    // A broken query is a 500. Only the states a caller can cause are mapped.
    expect(toDatabaseConstraintError(pgError({ code: "42601" }))).toBeNull();
    expect(toDatabaseConstraintError(new Error("boom"))).toBeNull();
    expect(toDatabaseConstraintError(null)).toBeNull();
  });
});
