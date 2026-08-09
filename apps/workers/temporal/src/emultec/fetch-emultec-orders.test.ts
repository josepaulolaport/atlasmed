import { describe, expect, test } from "bun:test";
import { buildEmultecOrderIdPageSql } from "./fetch-emultec-orders";

describe("buildEmultecOrderIdPageSql", () => {
  test("BACKFILL / INCREMENTAL page by id only", () => {
    const sql = buildEmultecOrderIdPageSql({
      mode: "INCREMENTAL",
      afterId: 100,
      limit: 50,
    });
    expect(sql).toContain("a.id > 100");
    expect(sql).toContain("LIMIT 50");
    expect(sql).not.toContain("Finalizado_Data");
  });

  test("RECONCILE adds date window", () => {
    const sql = buildEmultecOrderIdPageSql({
      mode: "RECONCILE",
      afterId: 0,
      limit: 20,
      sinceDate: "2026-01-01",
    });
    expect(sql).toContain("a.Data >= '2026-01-01'");
    expect(sql).toContain("a.Finalizado_Data >= '2026-01-01'");
    expect(sql).toContain("a.Sem_Faturamento_Data >= '2026-01-01'");
  });

  test("RECONCILE rejects bad sinceDate", () => {
    expect(() =>
      buildEmultecOrderIdPageSql({
        mode: "RECONCILE",
        afterId: 0,
        limit: 10,
        sinceDate: "01/01/2026",
      })
    ).toThrow(/sinceDate/);
  });
});
