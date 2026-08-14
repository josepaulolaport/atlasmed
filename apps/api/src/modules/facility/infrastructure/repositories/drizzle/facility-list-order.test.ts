import { describe, expect, it } from "bun:test";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import type { FacilityRepository } from "../../../application/interfaces/facility.repository.interface";
import {
  buildFacilityListConditions,
  buildFacilityListOrderBy,
} from "./drizzle-facility.repository";

/**
 * Compile-time only: every filter the list endpoint accepts must be declared on
 * both repository entry points.
 *
 * `findAllByIds` is the one that gets forgotten — it serves the Meilisearch
 * hydrate path, so a filter missing there fails only for searches, and only by
 * returning a plausible unfiltered page.
 *
 * This cannot be asserted at runtime: these are types. If a field is dropped
 * from either signature, this file stops compiling and `bun run typecheck`
 * fails, which is the point.
 */
type ListParams = Parameters<FacilityRepository["findAll"]>[0];
type HydrateParams = Parameters<FacilityRepository["findAllByIds"]>[0];

type Accepts<T, K extends keyof T> = Pick<T, K>;
type _ListAcceptsEveryFilter = Accepts<
  ListParams,
  | "productIds"
  | "clinicalFocusIds"
  | "unitTypeIds"
  | "legalDocumentType"
  | "cpfStatus"
  | "purchaseFunnelStages"
  | "purchaseProfile"
>;
type _HydrateAcceptsEveryFilter = Accepts<
  HydrateParams,
  | "productIds"
  | "clinicalFocusIds"
  | "unitTypeIds"
  | "legalDocumentType"
  | "cpfStatus"
  | "purchaseFunnelStages"
  | "purchaseProfile"
>;

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

const globalScope = { isGlobal: true } as const;

function renderConditions(
  params: Omit<Parameters<typeof buildFacilityListConditions>[0], "scope">,
) {
  const conditions = buildFacilityListConditions({ ...params, scope: globalScope });
  return dialect.sqlToQuery(conditions!).sql;
}

describe("buildFacilityListConditions", () => {
  it("requires every selected product, not any of them", () => {
    // Products used OR while clinical focuses used AND, so two filters that
    // look the same in the UI moved the result set in opposite directions:
    // adding a product widened it, adding a focus narrowed it.
    const sql = renderConditions({ productIds: [1, 2, 3] });
    expect(sql).toContain("count(distinct");
    expect(sql).toContain("= $");
  });

  it("matches clinical focuses the same way", () => {
    const sql = renderConditions({ clinicalFocusIds: [4, 5] });
    expect(sql).toContain("count(distinct");
  });

  it("de-duplicates ids so a repeat cannot make the count unreachable", () => {
    // "1,1,2" is two distinct products. Counting the raw length would demand
    // three distinct matches and return nothing at all.
    const repeated = renderConditions({ productIds: [1, 1, 2] });
    const distinct = renderConditions({ productIds: [1, 2] });
    expect(repeated).toBe(distinct);
  });

  it("matches any of the selected unit types", () => {
    // OR, deliberately: a facility has exactly one unit type, so AND across
    // several would always be empty.
    const sql = renderConditions({ unitTypeIds: [3, 7] });
    expect(sql).toContain('"facilities"."unit_type_id" in');
    expect(sql).not.toContain("count(distinct");
  });

  it("filters on the legal document type", () => {
    expect(renderConditions({ legalDocumentType: "CNPJ" })).toContain(
      '"facilities"."legal_document_type" = ',
    );
  });

  it("scopes both cpfStatus branches to CPF clinics", () => {
    // A CNPJ clinic with no CNPJ is a real problem, but not the one this
    // warning counts. Folding it in would make the Desempenho number disagree
    // with the list it opens.
    for (const cpfStatus of ["missing", "invalid"] as const) {
      expect(renderConditions({ cpfStatus })).toContain(
        '"facilities"."legal_document_type" = ',
      );
    }
  });

  it("treats a blank document as missing, not as present", () => {
    // The app renders a blank as "—", so a rep seeing a dash would not
    // understand its absence from a list of clinics without a CPF.
    const sql = renderConditions({ cpfStatus: "missing" });
    expect(sql).toContain("is null");
    expect(sql).toContain("btrim");
    expect(sql).not.toContain("is_valid_cpf");
  });

  it("asks the database for validity only on a non-blank document", () => {
    const sql = renderConditions({ cpfStatus: "invalid" });
    expect(sql).toContain("is_valid_cpf");
    // Without the blank guard, `not is_valid_cpf(null)` is NULL and matches
    // nothing — but a blank string is not NULL, so it would be reported as
    // invalid as well as missing, and one clinic would appear in both counts.
    expect(sql).toContain("btrim");
  });

  it("adds nothing for either new filter when they are absent", () => {
    const base = renderConditions({});
    expect(base).not.toContain("unit_type_id");
    expect(base).not.toContain("legal_document_type");
  });
});
