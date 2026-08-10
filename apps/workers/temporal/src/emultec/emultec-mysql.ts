import { environment } from "@atlasmed/config";
import {
  runEmultecQuery,
  closeEmultecPool,
  type EmultecMysqlConfig,
} from "@atlasmed/emultec-mysql";

export type { EmultecMysqlConfig };
export { closeEmultecPool as closeEmultecMysqlPool };

/**
 * Credentials come from the central environment (`@atlasmed/config`) and are
 * handed to the driver as a config object. They are never rendered into a
 * command line, which is how the previous `docker run … -p<password>` transport
 * leaked them into `ps` on the host and into Docker's process metadata.
 */
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
 * Run a read-only SELECT against Emultec.
 *
 * Returns tab-separated lines, preserving the exact shape the previous
 * `mysql -N -B` transport produced, so every parser above this is unchanged.
 */
export async function runEmultecMysqlQuery(
  sql: string,
  cfg: EmultecMysqlConfig = requireEmultecMysqlConfig()
): Promise<string[]> {
  return runEmultecQuery(sql, cfg);
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
