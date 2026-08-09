import type { OrderStatus } from "@atlasmed/database";

/**
 * Funnel-safe Emultec avulsa.Status → CRM order_status.
 * Unknown statuses land in PENDING (not DRAFT).
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
