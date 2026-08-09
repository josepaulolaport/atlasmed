import { EMULTEC_PRODUCT_WHITELIST_IDS } from "./whitelist";
import {
  digitsOnly,
  nullIfNullToken,
  requireEmultecMysqlConfig,
  runEmultecMysqlQuery,
} from "./emultec-mysql";

export type EmultecOrderLine = {
  idAvulsaItemEmultec: number;
  idProdutoEmultec: number;
  quantity: number;
  unitPrice: number;
};

export type EmultecOrderBundle = {
  idAvulsa: number;
  idCliente: number;
  idVendedor: number | null;
  status: string | null;
  orderedAt: string | null;
  notes: string | null;
  freight: number;
  grossWeight: number;
  netWeight: number;
  idClientePj: number | null;
  clientCnpjDigits: string | null;
  clientCpfDigits: string | null;
  pjCnpjDigits: string | null;
  lines: EmultecOrderLine[];
};

export type FetchEmultecOrdersPageInput = {
  /** Exclusive lower bound on avulsa.id (watermark). */
  afterId?: number;
  limit: number;
};

function whitelistSqlList(): string {
  return EMULTEC_PRODUCT_WHITELIST_IDS.join(",");
}

/**
 * Page of avulsa that have ≥1 whitelist product line, with those lines only.
 */
export async function fetchEmultecOrdersPage(
  input: FetchEmultecOrdersPageInput
): Promise<EmultecOrderBundle[]> {
  const cfg = requireEmultecMysqlConfig();
  const afterId = input.afterId ?? 0;
  const limit = Math.max(1, Math.min(input.limit, 500));
  const ids = whitelistSqlList();

  const idSql = [
    "SELECT DISTINCT a.id",
    "FROM avulsa a",
    "INNER JOIN avulsa_orcamento o ON o.Id_Avulsa = a.id",
    "INNER JOIN avulsa_orcamento_padrao p ON p.Id_Orc = o.id",
    `WHERE p.Id_Produto IN (${ids})`,
    `AND a.id > ${afterId}`,
    "ORDER BY a.id",
    `LIMIT ${limit};`,
  ].join(" ");

  const idLines = await runEmultecMysqlQuery(idSql, cfg);
  const avulsaIds = idLines
    .map((line) => Number(line.split("\t")[0]))
    .filter((n) => Number.isFinite(n));
  if (avulsaIds.length === 0) return [];

  const idList = avulsaIds.join(",");

  const headerSql = [
    "SELECT",
    "  a.id,",
    "  a.Id_Cliente,",
    "  a.Id_Vendedor,",
    "  a.Status,",
    "  a.Data,",
    "  a.Obs,",
    "  a.Frete,",
    "  a.Peso_Bruto,",
    "  a.Peso_Liq,",
    "  c.Id_Cliente_PJ,",
    "  c.CNPJ,",
    "  c.CPF,",
    "  pj.CNPJ AS PJ_CNPJ",
    "FROM avulsa a",
    "LEFT JOIN clientes c ON c.Id = a.Id_Cliente",
    "LEFT JOIN clientes pj ON pj.Id = c.Id_Cliente_PJ",
    `WHERE a.id IN (${idList})`,
    "ORDER BY a.id;",
  ].join(" ");

  const lineSql = [
    "SELECT",
    "  a.id AS id_avulsa,",
    "  p.id AS id_item,",
    "  p.Id_Produto,",
    "  p.Qtdade,",
    "  p.Valor",
    "FROM avulsa a",
    "INNER JOIN avulsa_orcamento o ON o.Id_Avulsa = a.id",
    "INNER JOIN avulsa_orcamento_padrao p ON p.Id_Orc = o.id",
    `WHERE a.id IN (${idList})`,
    `AND p.Id_Produto IN (${ids})`,
    "ORDER BY a.id, p.id;",
  ].join(" ");

  const [headerLines, itemLines] = await Promise.all([
    runEmultecMysqlQuery(headerSql, cfg),
    runEmultecMysqlQuery(lineSql, cfg),
  ]);

  const linesByAvulsa = new Map<number, EmultecOrderLine[]>();
  for (const line of itemLines) {
    const cols = line.split("\t");
    const idAvulsa = Number(cols[0]);
    const idItem = Number(cols[1]);
    const idProduto = Number(cols[2]);
    if (!Number.isFinite(idAvulsa) || !Number.isFinite(idItem) || !Number.isFinite(idProduto)) {
      continue;
    }
    const row: EmultecOrderLine = {
      idAvulsaItemEmultec: idItem,
      idProdutoEmultec: idProduto,
      quantity: Number(cols[3] ?? 0) || 0,
      unitPrice: Number(cols[4] ?? 0) || 0,
    };
    const list = linesByAvulsa.get(idAvulsa) ?? [];
    list.push(row);
    linesByAvulsa.set(idAvulsa, list);
  }

  return headerLines.map((line) => {
    const cols = line.split("\t");
    const idAvulsa = Number(cols[0]);
    const idCliente = Number(cols[1]);
    const idVendedorRaw = nullIfNullToken(cols[2]);
    const idClientePjRaw = nullIfNullToken(cols[9]);
    return {
      idAvulsa,
      idCliente,
      idVendedor: idVendedorRaw != null ? Number(idVendedorRaw) : null,
      status: nullIfNullToken(cols[3]),
      orderedAt: nullIfNullToken(cols[4]),
      notes: nullIfNullToken(cols[5]),
      freight: Number(cols[6] ?? 0) || 0,
      grossWeight: Number(cols[7] ?? 0) || 0,
      netWeight: Number(cols[8] ?? 0) || 0,
      idClientePj: idClientePjRaw != null ? Number(idClientePjRaw) : null,
      clientCnpjDigits: digitsOnly(nullIfNullToken(cols[10])),
      clientCpfDigits: digitsOnly(nullIfNullToken(cols[11])),
      pjCnpjDigits: digitsOnly(nullIfNullToken(cols[12])),
      lines: linesByAvulsa.get(idAvulsa) ?? [],
    } satisfies EmultecOrderBundle;
  });
}
