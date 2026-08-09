import { EMULTEC_PRODUCT_WHITELIST_IDS } from "./whitelist";
import type { EmultecProductRow } from "./map-emultec-product";
import {
  nullIfNullToken,
  requireEmultecMysqlConfig,
  runEmultecMysqlQuery,
} from "./emultec-mysql";

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

  const lines = await runEmultecMysqlQuery(sql, cfg);

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
