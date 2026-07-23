import { describe, expect, test } from "bun:test";
import {
  getPurchaseFunnelStagePresentation,
  getPurchaseProfileLabel,
  getPurchaseRecurrenceCommand,
  getPurchaseSourceLabel,
  formatPurchaseDate,
} from "./purchase-recurrence";

describe("purchase recurrence presentation", () => {
  test("maps funnel stages to pt-BR badges", () => {
    expect(getPurchaseFunnelStagePresentation("PURCHASE_WINDOW")).toEqual({
      label: "Período de compra",
      variant: "success",
    });
    expect(getPurchaseFunnelStagePresentation("INACTIVE").variant).toBe("destructive");
  });

  test("labels profiles and sources in pt-BR", () => {
    expect(getPurchaseProfileLabel("MONTHLY")).toBe("Mensal — 30 dias");
    expect(getPurchaseProfileLabel(null)).toBe("Automático");
    expect(getPurchaseSourceLabel("CALCULATED")).toBe("Calculado pelo histórico");
  });

  test("formats API date-only values without shifting the calendar day", () => {
    expect(formatPurchaseDate("2026-01-09")).toContain("9");
  });

  test("creates discriminated commands and validates custom intervals", () => {
    expect(getPurchaseRecurrenceCommand("AUTOMATIC", "")).toEqual({ mode: "AUTOMATIC" });
    expect(getPurchaseRecurrenceCommand("WEEKLY", "")).toEqual({ mode: "PRESET", profile: "WEEKLY" });
    expect(getPurchaseRecurrenceCommand("CUSTOM", "45")).toEqual({ mode: "CUSTOM", intervalDays: 45 });
    expect(getPurchaseRecurrenceCommand("CUSTOM", "0")).toBeNull();
    expect(getPurchaseRecurrenceCommand("CUSTOM", "2.5")).toBeNull();
  });
});
