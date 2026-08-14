import { EMULTEC_PRODUCT_WHITELIST_IDS } from "./whitelist";
import {
  digitsOnly,
  nullIfNullToken,
  requireEmultecMysqlConfig,
  runEmultecMysqlQuery,
  type EmultecMysqlConfig,
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
  /** `avulsa.Natureza` — VENDA / DOACAO. Decides the CRM order type. */
  nature: string | null;
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

/**
 * Page-level modes (HYBRID orchestrated above this).
 *
 * `DLQ_REPLAY` and `SKIP_RECHECK` do not page Emultec by id at all — they draw
 * their ids from our own tables and then fetch those rows by id, so neither
 * reaches `buildEmultecOrderIdPageSql`.
 */
export type EmultecOrderPageMode =
  | "BACKFILL"
  | "INCREMENTAL"
  | "RECONCILE"
  | "DLQ_REPLAY"
  | "SKIP_RECHECK";

export type FetchEmultecOrdersPageInput = {
  mode: EmultecOrderPageMode;
  /** Exclusive lower bound on avulsa.id. */
  afterId?: number;
  limit: number;
  /**
   * RECONCILE only: YYYY-MM-DD inclusive.
   * Matches avulsa.Data / Finalizado_Data / Sem_Faturamento_Data.
   */
  sinceDate?: string;
};

function whitelistSqlList(): string {
  return EMULTEC_PRODUCT_WHITELIST_IDS.join(",");
}

function assertSinceDate(sinceDate: string | undefined): string {
  if (!sinceDate || !/^\d{4}-\d{2}-\d{2}$/.test(sinceDate)) {
    throw new Error("RECONCILE requires sinceDate as YYYY-MM-DD");
  }
  return sinceDate;
}

/** Build id-page SQL (exported for unit tests). */
export function buildEmultecOrderIdPageSql(input: {
  mode: Exclude<EmultecOrderPageMode, "DLQ_REPLAY" | "SKIP_RECHECK">;
  afterId: number;
  limit: number;
  sinceDate?: string;
}): string {
  const ids = whitelistSqlList();
  const afterId = input.afterId;
  const limit = input.limit;
  const base = [
    "SELECT DISTINCT a.id",
    "FROM avulsa a",
    "INNER JOIN avulsa_orcamento o ON o.Id_Avulsa = a.id",
    "INNER JOIN avulsa_orcamento_padrao p ON p.Id_Orc = o.id",
    `WHERE p.Id_Produto IN (${ids})`,
    `AND a.id > ${afterId}`,
  ];

  if (input.mode === "RECONCILE") {
    const since = assertSinceDate(input.sinceDate);
    base.push(
      "AND (",
      `  a.Data >= '${since}'`,
      `  OR a.Finalizado_Data >= '${since}'`,
      `  OR a.Sem_Faturamento_Data >= '${since}'`,
      ")"
    );
  }

  base.push("ORDER BY a.id", `LIMIT ${limit};`);
  return base.join(" ");
}

export async function fetchEmultecOrdersByIds(
  avulsaIds: number[]
): Promise<EmultecOrderBundle[]> {
  const cfg = requireEmultecMysqlConfig();
  return loadBundlesForIds(avulsaIds, cfg);
}

async function loadBundlesForIds(
  avulsaIds: number[],
  cfg: EmultecMysqlConfig
): Promise<EmultecOrderBundle[]> {
  if (avulsaIds.length === 0) return [];
  const ids = whitelistSqlList();
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
    "  pj.CNPJ AS PJ_CNPJ,",
    "  a.Natureza",
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
      nature: nullIfNullToken(cols[13]),
      lines: linesByAvulsa.get(idAvulsa) ?? [],
    } satisfies EmultecOrderBundle;
  });
}

/**
 * Page of avulsa that have ≥1 whitelist product line, with those lines only.
 *
 * - BACKFILL / INCREMENTAL: `id > afterId` (caller sets watermark for incremental)
 * - RECONCILE: same + date window on Data / Finalizado_Data / Sem_Faturamento_Data
 */
export async function fetchEmultecOrdersPage(
  input: FetchEmultecOrdersPageInput
): Promise<EmultecOrderBundle[]> {
  if (input.mode === "DLQ_REPLAY" || input.mode === "SKIP_RECHECK") {
    throw new Error(`${input.mode} draws ids locally, then fetchEmultecOrdersByIds`);
  }

  const cfg = requireEmultecMysqlConfig();
  const afterId = input.afterId ?? 0;
  const limit = Math.max(1, Math.min(input.limit, 500));

  const idSql = buildEmultecOrderIdPageSql({
    mode: input.mode,
    afterId,
    limit,
    sinceDate: input.sinceDate,
  });

  const idLines = await runEmultecMysqlQuery(idSql, cfg);
  const avulsaIds = idLines
    .map((line) => Number(line.split("\t")[0]))
    .filter((n) => Number.isFinite(n));

  return loadBundlesForIds(avulsaIds, cfg);
}
