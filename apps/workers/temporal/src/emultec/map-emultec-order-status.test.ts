import { describe, expect, test } from "bun:test";
import { mapEmultecOrderStatus } from "./map-emultec-order-status";

describe("mapEmultecOrderStatus", () => {
  test("maps funnel statuses", () => {
    expect(mapEmultecOrderStatus("FATURADO")).toBe("INVOICED");
    expect(mapEmultecOrderStatus("aprovado")).toBe("APPROVED");
    expect(mapEmultecOrderStatus("SEM FATURAMENTO")).toBe("NO_BILLING");
    expect(mapEmultecOrderStatus("REPROVADO")).toBe("REJECTED");
  });

  test("unknown → PENDING", () => {
    expect(mapEmultecOrderStatus("ORCAMENTO")).toBe("PENDING");
    expect(mapEmultecOrderStatus("SEPARANDO")).toBe("PENDING");
    expect(mapEmultecOrderStatus(null)).toBe("PENDING");
  });
});
