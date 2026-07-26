/**
 * Hard gate around `drizzle-kit push`.
 *
 * Incident 2026-07-26: `drizzle-kit push --force` against populated local DB
 * (`atlasmed-3`) auto-accepted data-loss DDL and emptied `facilities` /
 * `territories` / `facility_vertical_profiles` while leaving orphan children.
 *
 * Push is allowed ONLY against disposable local DB names (allowlist).
 * Valued DBs such as `atlasmed-3` can never be push targets — no env override.
 */
import postgres from "postgres";
import {
  assertDisposableDatabaseName,
  assertLocalDatabaseUrl,
  parseDatabaseName,
  parsePushArgs,
} from "./db-push-gates";

const PROTECTED_TABLES = [
  "facilities",
  "professionals",
  "territories",
  "users",
  "facility_vertical_profiles",
] as const;

async function countProtectedRows(databaseUrl: string): Promise<
  Array<{ table: string; count: number }>
> {
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    const counts: Array<{ table: string; count: number }> = [];
    for (const table of PROTECTED_TABLES) {
      const exists = await sql`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = ${table}
        ) AS ok
      `;
      if (!exists[0]?.ok) {
        counts.push({ table, count: 0 });
        continue;
      }
      const rows = await sql.unsafe(
        `SELECT count(*)::int AS count FROM public.${table}`,
      );
      counts.push({ table, count: Number(rows[0]?.count ?? 0) });
    }
    return counts;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  if (process.env.ATLASMED_ALLOW_DB_PUSH !== "1") {
    throw new Error(
      [
        "db:push refused without ATLASMED_ALLOW_DB_PUSH=1.",
        "Prefer: bunx drizzle-kit generate && bun run db:migrate.",
        "Push is only for disposable local DBs (atlasmed_test / scratch / empty).",
      ].join("\n"),
    );
  }

  const { force, forward } = parsePushArgs(process.argv.slice(2));
  assertLocalDatabaseUrl(databaseUrl);
  assertDisposableDatabaseName(parseDatabaseName(databaseUrl));

  if (force) {
    const allowForce =
      process.env.ATLASMED_ALLOW_DB_PUSH_FORCE === "1" &&
      process.env.ATLASMED_ALLOW_DATA_LOSS === "1";
    if (!allowForce) {
      throw new Error(
        [
          "db:push refused: --force auto-accepts data-loss DDL (truncate/drop).",
          "Incident 2026-07-26: wiped facilities/territories on atlasmed-3.",
          "Do not use --force. Prefer generate + db:migrate.",
          "Test-DB emergency only: ATLASMED_ALLOW_DB_PUSH_FORCE=1 ATLASMED_ALLOW_DATA_LOSS=1",
        ].join("\n"),
      );
    }
  }

  const allowDataLoss = process.env.ATLASMED_ALLOW_DATA_LOSS === "1";
  const counts = await countProtectedRows(databaseUrl);
  const nonempty = counts.filter((row) => row.count > 0);

  if (nonempty.length > 0 && !allowDataLoss) {
    const detail = nonempty.map((r) => `  - ${r.table}: ${r.count}`).join("\n");
    throw new Error(
      [
        "db:push refused: DATABASE_URL already has protected CRM data.",
        "push can truncate/recreate tables when unique indexes or type changes land.",
        "Non-empty protected tables:",
        detail,
        "",
        "Safe path: generate a migration and apply with bun run db:migrate.",
        "Override only on disposable test DBs: ATLASMED_ALLOW_DATA_LOSS=1",
      ].join("\n"),
    );
  }

  if (nonempty.length > 0 && allowDataLoss) {
    console.warn(
      "[db:push] ATLASMED_ALLOW_DATA_LOSS=1 — proceeding against populated disposable DB. Data loss possible.",
    );
  }

  const args = ["drizzle-kit", "push", ...forward];
  if (force) args.push("--force");

  const proc = Bun.spawn(["bunx", ...args], {
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
    env: process.env,
  });
  const code = await proc.exited;
  process.exit(code);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
