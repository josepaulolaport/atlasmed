import { describe, expect, it } from "bun:test";
import { sql } from "drizzle-orm";
import fixture from "../../../../../../../../packages/database/fixtures/cpf-checksum-cases.json";
import { db } from "../../../../../infrastructure/database/db";
import { isDatabaseReachable } from "../../../../../test-utils/db-harness";

/**
 * The database's half of the shared CPF fixture.
 *
 * `is_valid_cpf` exists because the Desempenho warning reports "CPF inválido"
 * as its own count: only Postgres can say which rows those are, for the count
 * and for a paginated list. It is the same rule as `isValidCpfDigits` and its
 * Dart twin, so it answers the same cases — a bug fixed in one implementation
 * and not the others would otherwise pass everywhere.
 *
 * Against a real database, deliberately: the point of this function is what
 * Postgres computes, and a reimplementation in the test would only assert that
 * the test agrees with itself.
 */
const dbUp = await isDatabaseReachable();
const { cases } = fixture;

describe.if(dbUp)("is_valid_cpf", () => {
  it("agrees with the shared fixture on every case", async () => {
    const disagreements: string[] = [];

    for (const entry of cases) {
      const rows = await db.execute<{ ok: boolean | null }>(
        sql`select is_valid_cpf(${entry.raw}) as ok`,
      );
      const got = rows[0]?.ok === true;
      if (got !== entry.valid) {
        disagreements.push(
          `${JSON.stringify(entry.raw)}: expected ${entry.valid}, got ${got} (${entry.why})`,
        );
      }
    }

    // Reported together rather than failing on the first: when the rule is
    // wrong it is usually wrong for a family of inputs, and seeing all of them
    // says which branch broke.
    expect(disagreements).toEqual([]);
  });

  it("returns NULL for NULL rather than false", async () => {
    // STRICT, and load-bearing. "Missing" and "invalid" are separate counts;
    // if NULL returned false then `NOT is_valid_cpf(legal_document)` would be
    // true for every clinic with no CPF at all, and each would be reported
    // twice — once as missing and once as invalid.
    const rows = await db.execute<{ ok: boolean | null }>(
      sql`select is_valid_cpf(null::text) as ok`,
    );
    expect(rows[0]?.ok).toBeNull();
  });

  it("is immutable, so it can back a partial index later", async () => {
    // Not decoration: Postgres refuses an index on a non-immutable function,
    // and discovering that at the point the table has grown enough to need one
    // is the wrong time.
    const rows = await db.execute<{ volatile: string }>(
      sql`select provolatile as volatile from pg_proc where proname = 'is_valid_cpf'`,
    );
    expect(rows[0]?.volatile).toBe("i");
  });
});
