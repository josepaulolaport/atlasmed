import { environment } from "@atlasmed/config";
import { EMULTEC_PRODUCT_WHITELIST_IDS } from "./whitelist";
import type { EmultecProductRow } from "./map-emultec-product";

function requireEmultecMysqlConfig() {
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
 * Fetch whitelist products via dockerized mysql client (no mysql2 dep for Slice 1).
 * Expects local Docker daemon + network reachability to Emultec host.
 */
export async function fetchEmultecWhitelistProducts(): Promise<
  EmultecProductRow[]
> {
  const cfg = requireEmultecMysqlConfig();
  const ids = EMULTEC_PRODUCT_WHITELIST_IDS.join(",");
  const sql = [
    "SELECT id, Codigo, Codigo_Barra, Codigo_Comercial, Descricao, Grupo, Marca, Tipo",
    "FROM produtos",
    `WHERE id IN (${ids})`,
    "ORDER BY id;",
  ].join(" ");

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

  // Emultec MySQL often returns latin1; decode bytes, not UTF-8 TextDecoder.
  const stdoutBuf = Buffer.from(await new Response(proc.stdout).arrayBuffer());
  const stderrBuf = Buffer.from(await new Response(proc.stderr).arrayBuffer());
  const exit = await proc.exited;
  const stdout = stdoutBuf.toString("latin1");
  const stderr = stderrBuf.toString("latin1");

  if (exit !== 0) {
    throw new Error(
      `Emultec mysql fetch failed (exit ${exit}): ${stderr.trim() || stdout.trim()}`
    );
  }

  const lines = stdout
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0 && !line.includes("Using a password"));

  return lines.map((line) => {
    const cols = line.split("\t");
    const id = Number(cols[0]);
    if (!Number.isFinite(id)) {
      throw new Error(`Bad Emultec product row: ${line}`);
    }
    return {
      id,
      codigo: nullIfNullToken(cols[1]),
      codigoBarra: nullIfNullToken(cols[2]),
      codigoComercial: nullIfNullToken(cols[3]),
      descricao: cols[4] ?? "",
      grupo: nullIfNullToken(cols[5]),
      marca: nullIfNullToken(cols[6]),
      tipo: nullIfNullToken(cols[7]),
    };
  });
}

function nullIfNullToken(value: string | undefined): string | null {
  if (value == null || value === "NULL" || value === "") return null;
  return value;
}
