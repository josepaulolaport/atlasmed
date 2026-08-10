import mysql from "mysql2/promise";

export type EmultecMysqlConfig = {
  host: string;
  user: string;
  password: string;
  database: string;
  port: number;
};

/**
 * Emultec is a THIRD-PARTY production database. Everything here is sized to be
 * a considerate guest rather than a fast one — we do not own their capacity and
 * cannot see their load.
 *
 * Two connections, not a pool per query. This replaced a layer that shelled out
 * to `docker run --rm mysql:8 mysql -h ... -p<password> -e "SQL"` for every
 * statement, which meant a fresh TCP connect and auth handshake per query, the
 * password visible in `ps` on the host, and no timeout of any kind.
 */
const CONNECTION_LIMIT = 2;
/** Give up dialling rather than queue against an unreachable or saturated host. */
const CONNECT_TIMEOUT_MS = 10_000;
/** Wait for a free connection from our own pool, not theirs. */
const ACQUIRE_TIMEOUT_MS = 15_000;
/**
 * Server-side cap. MySQL kills the SELECT itself, so a slow query cannot sit in
 * their process list holding one of their `max_connections` slots for as long
 * as our activity timeout allows (30 minutes).
 *
 * MAX_EXECUTION_TIME applies to SELECT only, which is all we issue.
 */
const STATEMENT_TIMEOUT_MS = 60_000;



let pool: mysql.Pool | undefined;
let poolKey: string | undefined;

/** Identifies the pool's target without embedding the password. */
function configKey(cfg: EmultecMysqlConfig): string {
  return `${cfg.user}@${cfg.host}:${cfg.port}/${cfg.database}`;
}

function getPool(cfg: EmultecMysqlConfig): mysql.Pool {
  const key = configKey(cfg);
  if (pool && poolKey === key) return pool;

  if (pool) {
    // Config changed under us (tests, re-read env). Close the old one rather
    // than leaking connections against their server.
    void pool.end().catch(() => {});
  }

  pool = mysql.createPool({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    connectionLimit: CONNECTION_LIMIT,
    // Queue rather than open more than CONNECTION_LIMIT; never burst on them.
    waitForConnections: true,
    queueLimit: 0,
    connectTimeout: CONNECT_TIMEOUT_MS,
    // Emultec returns latin1. The previous layer decoded the CLI's bytes as
    // latin1 by hand; this makes the driver do it properly.
    charset: "latin1",
    // Values arrive as strings, matching what `mysql -N -B` produced, so the
    // existing parsers are unchanged. Dates in particular must not become Date
    // objects here — downstream expects the raw 'YYYY-MM-DD' text.
    dateStrings: true,
    timezone: "Z",
    enableKeepAlive: true,
    keepAliveInitialDelay: 10_000,
  });
  poolKey = key;

  return pool;
}

/** Close the shared pool. Call on worker shutdown so their server sees a clean FIN. */
export async function closeEmultecPool(): Promise<void> {
  if (!pool) return;
  const closing = pool;
  pool = undefined;
  poolKey = undefined;
  await closing.end().catch((error) => {
    console.warn("emultec.mysql.pool_close_failed", String(error));
  });
}

/** `mysql -N -B` rendered NULL as the literal token "NULL"; parsers rely on it. */
function renderValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString("latin1");
  return String(value);
}

/**
 * Run a read-only SELECT against Emultec.
 *
 * Returns tab-separated lines, preserving the exact shape the previous
 * `mysql -N -B` transport produced so every parser above this stays unchanged.
 *
 * Read-only is enforced here as well as by convention: anything that is not a
 * SELECT is refused before it reaches their server. That is a guard against our
 * own future mistakes, not against a hostile caller — the real protection is
 * that the Emultec credential should be granted SELECT only.
 */
export async function runEmultecQuery(
  sql: string,
  cfg: EmultecMysqlConfig
): Promise<string[]> {
  const trimmed = sql.trim();
  if (!/^select\b/i.test(trimmed)) {
    throw new Error(
      "Emultec queries must be SELECT — this connection is read-only by contract"
    );
  }

  const connection = await Promise.race([
    getPool(cfg).getConnection(),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Timed out acquiring an Emultec connection")),
        ACQUIRE_TIMEOUT_MS
      )
    ),
  ]);

  try {
    // Server-side kill switch, set per checkout because a pooled connection may
    // be reused and we do not want to rely on it persisting.
    await connection.query(`SET SESSION MAX_EXECUTION_TIME = ${STATEMENT_TIMEOUT_MS}`);

    const [rows] = await connection.query(trimmed);

    if (!Array.isArray(rows)) return [];

    return (rows as Array<Record<string, unknown>>).map((row) =>
      Object.values(row).map(renderValue).join("\t")
    );
  } finally {
    connection.release();
  }
}

