import { describe, expect, test } from "bun:test";
import { runEmultecQuery } from "./index";

const cfg = {
  host: "127.0.0.1",
  port: 3306,
  user: "u",
  password: "p",
  database: "d",
};

/**
 * Emultec is a third-party production database. The guarantee worth testing
 * without one in front of us is that a non-SELECT never reaches it — the check
 * happens before any connection is acquired, so these assertions do not need a
 * server and cannot accidentally dial one.
 */
describe("runEmultecQuery read-only guard", () => {
  const rejected = [
    "UPDATE avulsa SET Data = NOW()",
    "DELETE FROM avulsa",
    "INSERT INTO avulsa (id) VALUES (1)",
    "DROP TABLE avulsa",
    "TRUNCATE avulsa",
    // A SELECT is not a licence for what follows it.
    "SET SESSION sql_mode = ''",
  ];

  for (const sql of rejected) {
    test(`refuses: ${sql.split(" ")[0]}`, async () => {
      await expect(runEmultecQuery(sql, cfg)).rejects.toThrow(/read-only/i);
    });
  }

  test("refuses a statement that only looks like a SELECT", async () => {
    await expect(
      runEmultecQuery("WITH x AS (SELECT 1) DELETE FROM avulsa", cfg)
    ).rejects.toThrow(/read-only/i);
  });

  test("leading whitespace and case do not bypass the guard", async () => {
    // Rejected for the right reason: it is a DELETE, not a formatting quirk.
    await expect(runEmultecQuery("\n   delete from avulsa", cfg)).rejects.toThrow(
      /read-only/i
    );
  });
});
