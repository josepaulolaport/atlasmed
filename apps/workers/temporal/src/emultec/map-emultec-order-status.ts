import type { OrderStatus } from "@atlasmed/database";

/**
 * Emultec `avulsa.Status` → CRM `order_status`. Unknown statuses land in
 * PENDING (not DRAFT).
 *
 * Status says how far the order got, not what kind of movement it was — see
 * `mapEmultecOrderType` for that. The two were conflated while every order was
 * written as a `SALE`: donations stayed out of the purchase funnel only because
 * they carry `SEM FATURAMENTO`, which the funnel's status filter happens to
 * exclude. `NO_BILLING` now means only "never invoiced", which is also true of
 * 229 genuine sales worth about R$4.9M.
 */
export function mapEmultecOrderStatus(
  raw: string | null | undefined
): OrderStatus {
  const status = (raw ?? "").trim().toUpperCase();
  switch (status) {
    case "FATURADO":
      return "INVOICED";
    case "APROVADO":
      return "APPROVED";
    case "SEM FATURAMENTO":
      return "NO_BILLING";
    case "REPROVADO":
      return "REJECTED";
    default:
      return "PENDING";
  }
}
