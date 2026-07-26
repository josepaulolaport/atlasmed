/**
 * Pure gates for db-push. Kept separate so tests can import without spawning
 * drizzle-kit. See db-push.ts for the CLI entrypoint.
 *
 * Incident 2026-07-26: push --force wiped CRM tables on atlasmed-3.
 */

/** Only these local DB names may ever receive drizzle-kit push. */
export const DISPOSABLE_DB_NAMES = new Set([
  "atlasmed_test",
  "atlasmed_scratch",
  "atlasmed_empty",
]);

export function parseDatabaseName(url: string): string {
  let pathname = "";
  try {
    pathname = new URL(url).pathname;
  } catch {
    throw new Error("DATABASE_URL is not a valid URL");
  }
  const name = pathname.replace(/^\//, "").split("/")[0] ?? "";
  if (!name) {
    throw new Error("DATABASE_URL has no database name");
  }
  return decodeURIComponent(name);
}

export function parsePushArgs(argv: string[]) {
  const forward: string[] = [];
  let force = false;
  for (const arg of argv) {
    if (arg === "--force" || arg === "-f") {
      force = true;
      continue;
    }
    forward.push(arg);
  }
  return { force, forward };
}

export function assertLocalDatabaseUrl(url: string): void {
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error("DATABASE_URL is not a valid URL");
  }

  const isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local");

  if (!isLocal) {
    throw new Error(
      `db:push refused: DATABASE_URL host "${host}" is not local. ` +
        `Use generate + db:migrate. Never drizzle-kit push against shared/cloud DBs.`,
    );
  }
}

export function assertDisposableDatabaseName(dbName: string): void {
  if (!DISPOSABLE_DB_NAMES.has(dbName)) {
    throw new Error(
      [
        `db:push refused: database "${dbName}" is not disposable.`,
        `Allowed names only: ${[...DISPOSABLE_DB_NAMES].join(", ")}.`,
        "Valued local DBs (e.g. atlasmed-3) must use generate + db:migrate.",
        "Incident 2026-07-26: push --force wiped facilities on a non-disposable DB.",
        "No env override exists for this gate.",
      ].join("\n"),
    );
  }
}
