import type { OrderType } from "@atlasmed/database";

/**
 * Emultec `avulsa.Natureza` → CRM `order_type`.
 *
 * A third of the whitelist volume is `DOACAO` — 6 277 orders across three years,
 * steady at roughly 1 400–3 200 a year, carrying a declared value averaging
 * R$1.8k against R$10.4k for a sale. Donated product, not bought product.
 *
 * The importer used to write `SALE` for every row, so donations were kept out of
 * the purchase funnel only by accident: they happen to carry
 * `Status = 'SEM FATURAMENTO'`, and the funnel's predicate excludes anything that
 * is not `APPROVED`/`INVOICED`. That coincidence is load-bearing in the wrong
 * place — it also excludes 229 genuine sales that were never billed, and it
 * would silently start counting donations the day one arrived `FATURADO`.
 *
 * Typing the order says what it is, and the funnel's existing
 * `type IN ('SALE','CONSIGNMENT')` filter then excludes donations on purpose.
 *
 * Unknown natures map to `OTHER` rather than `SALE`: guessing "sale" is what
 * puts something in the funnel, and a nature we have not seen should not enter
 * it until someone looks.
 */
export function mapEmultecOrderType(raw: string | null | undefined): OrderType {
  const nature = (raw ?? "").trim().toUpperCase();
  switch (nature) {
    case "VENDA":
      return "SALE";
    case "DOACAO":
    case "DOAÇÃO":
      return "DONATION";
    case "":
      // Emultec leaves it blank on a handful of rows, nearly all FATURADO with
      // a sale's value profile. Treating a billed order as a sale is the
      // reading that matches the rest of the row.
      return "SALE";
    default:
      return "OTHER";
  }
}
