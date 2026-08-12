import { describe, expect, test } from "bun:test";
import { deriveShare } from "@atlasmed/facility-insights";
import { sql } from "drizzle-orm";
import { isDatabaseReachable, withRollback } from "../../../../../test-utils/db-harness";

/**
 * The share rule has two expressions. This is what stops them diverging.
 *
 * One lives in `deriveShare`, because the clinic screen computes live so that
 * its headline agrees with the per-product rows underneath it. The other is the
 * generated `share` column on `facility_metric_snapshots`, because cross-clinic
 * aggregates average share in SQL. Neither can be deleted in favour of the
 * other, so the rule is stated twice, in two languages.
 *
 * Left alone, that is a bug waiting: an edit to one and not the other shows a
 * different share for the same clinic depending on which screen you opened, and
 * every test still passes. So the same operands go through both and must agree.
 *
 * The column is evaluated by Postgres directly rather than through a seeded
 * row, which keeps this test about the arithmetic and lets it cover the pairs a
 * row could not hold — the check constraint forbids a claim alongside a
 * competitor, and that combination still needs a defined answer here.
 */
const dbUp = await isDatabaseReachable();

/** Exactly the expression on `facility_metric_snapshots.share`. */
const GENERATED_SHARE = `case
      when (no_other_brands or theirs_qty > 0) and ours_qty + theirs_qty > 0
      then ours_qty / (ours_qty + theirs_qty)
    end`;

const CASES: Array<{ name: string; ours: number; theirs: number; claim: boolean }> = [
  { name: "nothing known at all", ours: 0, theirs: 0, claim: false },
  { name: "orders, but nobody has looked at the market", ours: 30, theirs: 0, claim: false },
  { name: "orders, and a rep says there is no other brand", ours: 30, theirs: 0, claim: true },
  { name: "the market is known empty and we sell nothing", ours: 0, theirs: 0, claim: true },
  { name: "we sell nothing into a market we can see", ours: 0, theirs: 40, claim: false },
  { name: "a mixed market", ours: 30, theirs: 10, claim: false },
  { name: "a mixed market, claim ignored", ours: 30, theirs: 10, claim: true },
  { name: "we are the smaller half", ours: 1, theirs: 999, claim: false },
  { name: "a share that does not terminate", ours: 1, theirs: 2, claim: false },
];

describe.skipIf(!dbUp)("the share rule agrees with the generated column", () => {
  for (const scenario of CASES) {
    test(scenario.name, async () => {
      await withRollback(async (tx) => {
        const [row] = await tx.execute<{ share: string | null }>(
          sql`select ${sql.raw(GENERATED_SHARE)} as share
              from (select
                      ${scenario.ours}::numeric(14, 2) as ours_qty,
                      ${scenario.theirs}::numeric(14, 2) as theirs_qty,
                      ${scenario.claim}::boolean as no_other_brands
                   ) as operands`,
        );

        const { share } = deriveShare(scenario.ours, scenario.theirs, scenario.claim);

        if (share === null) {
          // Null is the load-bearing case: it is what separates "we sell
          // nothing" from "we know nothing", so a 0 creeping into either side
          // is the failure this test exists for.
          expect(row!.share).toBeNull();
          return;
        }

        expect(row!.share).not.toBeNull();
        // The column is numeric(9, 8); the function is a float. They agree to
        // the column's precision, which is the only precision anyone reads.
        expect(Number(row!.share)).toBeCloseTo(share, 8);
      });
    });
  }
});
