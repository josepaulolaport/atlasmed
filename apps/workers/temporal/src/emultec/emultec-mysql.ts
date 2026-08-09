import { environment } from "@atlasmed/config";

export type EmultecMysqlConfig = {
  host: string;
  user: string;
  password: string;
  database: string;
  port: number;
};

/** True once EMULTEC_MYSQL_HOST/USER/PASSWORD are all set. Safe to call with no config present. */
export function isEmultecMysqlConfigured(): boolean {
  return Boolean(
    environment.EMULTEC_MYSQL_HOST &&
      environment.EMULTEC_MYSQL_USER &&
      environment.EMULTEC_MYSQL_PASSWORD
  );
}

export function requireEmultecMysqlConfig(): EmultecMysqlConfig {
  const host = environment.EMULTEC_MYSQL_HOST;
  const user = environment.EMULTEC_MYSQL_USER;
  const password = environment.EMULTEC_MYSQL_PASSWORD;
  const database = environment.EMULTEC_MYSQL_DATABASE;
  const port = environment.EMULTEC_MYSQL_PORT;

  if (!host || !user || !password) {
    throw new Error(
      "EMULTEC_MYSQL_HOST, EMULTEC_MYSQL_USER, EMULTEC_MYSQL_PASSWORD required"
    );
  }

  return { host, user, password, database, port };
}

/**
 * Run a read-only SQL statement via dockerized mysql:8 client.
 * Emultec often returns latin1 — decode as latin1.
 */
export async function runEmultecMysqlQuery(
  sql: string,
  cfg: EmultecMysqlConfig = requireEmultecMysqlConfig()
): Promise<string[]> {
  const proc = Bun.spawn(
    [
      "docker",
      "run",
      "--rm",
      "mysql:8",
      "mysql",
      "-h",
      cfg.host,
      "-P",
      String(cfg.port),
      "-u",
      cfg.user,
      `-p${cfg.password}`,
      cfg.database,
      "-N",
      "-B",
      "-e",
      sql,
    ],
    { stdout: "pipe", stderr: "pipe" }
  );

  const stdoutBuf = Buffer.from(await new Response(proc.stdout).arrayBuffer());
  const stderrBuf = Buffer.from(await new Response(proc.stderr).arrayBuffer());
  const exit = await proc.exited;
  const stdout = stdoutBuf.toString("latin1");
  const stderr = stderrBuf.toString("latin1");

  if (exit !== 0) {
    throw new Error(
      `Emultec mysql query failed (exit ${exit}): ${stderr.trim() || stdout.trim()}`
    );
  }

  return stdout
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0 && !line.includes("Using a password"));
}

export function nullIfNullToken(value: string | undefined): string | null {
  if (value == null || value === "NULL" || value === "") return null;
  return value;
}

export function digitsOnly(value: string | null | undefined): string | null {
  if (value == null) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length === 0 ? null : digits;
}
