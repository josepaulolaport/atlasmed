import { describe, expect, it } from "bun:test";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { buildFacilityListOrderBy } from "./drizzle-facility.repository";

/**
 * Explorar offers "Nome A–Z" and "Nome Z–A" for clinics, and neither worked.
 *
 * Two independent defects, found 2026-08-13 and both reproduced against
 * production before fixing:
 *
 *   1. `name` was absent from the "specific sort" list in findAll, so whenever
 *      the request carried coordinates — which the client sends on every
 *      request regardless of sort — the query ordered by distance instead.
 *      Selecting "Nome Z–A" returned a list in strictly ascending distance
 *      order while the sheet showed the name option ticked.
 *   2. This function had no `name` case at all. It fell through to a default
 *      that returns ascending and ignores `order`, so descending was
 *      unreachable even without the first defect.
 *
 * The function is exported and had no test. The suite only ever exercised
 * `purchaseFunnelStage`, one of the three sorts that happened to work.
 *
 * Asserting on rendered SQL rather than on the expression objects: those are
 * cyclic and compare equal by identity, so a test over them would pass whether
 * or not the direction was applied.
 */
const dialect = new PgDialect();

function renderOrderBy(params: Parameters<typeof buildFacilityListOrderBy>[0]) {
  const expressions = buildFacilityListOrderBy(params);
  return dialect.sqlToQuery(sql.join(expressions as never, sql`, `)).sql;
}

describe("buildFacilityListOrderBy", () => {
  it("orders by name ascending when asked", () => {
    expect(renderOrderBy({ sort: "name", order: "asc" })).toBe(
      '"facilities"."name" asc, "facilities"."id" asc',
    );
  });

  it("orders by name descending when asked", () => {
    // The defect: this used to render ascending, because `order` was dropped.
    expect(renderOrderBy({ sort: "name", order: "desc" })).toBe(
      '"facilities"."name" desc, "facilities"."id" asc',
    );
  });

  it("keeps a deterministic tiebreaker so pages do not overlap", () => {
    // Two clinics sharing a name must still paginate consistently, so id
    // remains ascending in both directions rather than following `order`.
    for (const order of ["asc", "desc"] as const) {
      expect(renderOrderBy({ sort: "name", order })).toContain(
        '"facilities"."id" asc',
      );
    }
  });

  it("still defaults to name ascending when no sort is given", () => {
    expect(renderOrderBy({})).toBe(
      '"facilities"."name" asc, "facilities"."id" asc',
    );
  });

  it("leaves the purchase sorts on their own expressions", () => {
    // Guards the fix against having quietly rerouted them through `name`.
    const funnel = renderOrderBy({ sort: "purchaseFunnelStage", order: "desc" });
    expect(funnel).toContain("desc");
    expect(funnel).not.toBe(renderOrderBy({ sort: "name", order: "desc" }));
  });
});
