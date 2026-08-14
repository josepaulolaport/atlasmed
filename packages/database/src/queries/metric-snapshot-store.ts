import { and, asc, eq, gt, gte, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { union } from "drizzle-orm/pg-core";
import {
  type MetricSnapshotStore,
} from "@atlasmed/facility-insights";
import type { AnyDatabase } from "../client";
import { facilityVerticalProfiles } from "../schema/public/facilities";
import { orderItems, orders } from "../schema/public/orders";
import { productEquivalences, products } from "../schema/public/catalog";
import {
  facilityMetricSnapshots,
  facilityProductUsage,
  productPotentialDefinitions,
  productPotentialLinks,
} from "../schema/public/facility-potential";

/**
 * The storage side of the metric recompute (spec 0013 §4.3–4.4).
 *
 * **Why it lives in the database package.** Two callers need it: the API, which
 * recomputes inline when a rep edits a quantity, and the Temporal worker, which
 * runs the reconciliation sweep. The worker cannot import from `apps/api`, so
 * the alternative is a second copy of these queries in the worker — and these
 * queries are not plumbing. `sumOurs` encodes ADR 0003's eligible order statuses
 * and types, the `metric_units` multiplication, the per-linha join, and the São
 * Paulo month boundary. Every one of those was silently wrong at some point
 * before P4-1, and none of them failed loudly when they were.
 *
 * One definition, two callers.
 */
export function createMetricSnapshotStore(database: AnyDatabase): MetricSnapshotStore {
  return {
    async findProfile(profileId) {
      const [row] = await database
        .select({
          id: facilityVerticalProfiles.id,
          facilityId: facilityVerticalProfiles.facilityId,
          verticalId: facilityVerticalProfiles.verticalId,
        })
        .from(facilityVerticalProfiles)
        .where(eq(facilityVerticalProfiles.id, profileId))
        .limit(1);
      return row ?? null;
    },

    async listDefinitionIds({ verticalId }) {
      const rows = await database
        .select({ id: productPotentialDefinitions.id })
        .from(productPotentialDefinitions)
        .where(
          and(
            eq(productPotentialDefinitions.verticalId, verticalId),
            isNull(productPotentialDefinitions.deletedAt),
          ),
        );
      return rows.map((row) => row.id);
    },

    async sumOurs(input) {
      if (input.definitionIds.length === 0) return [];
      const rows = await database
        .select({
          definitionId: productPotentialLinks.definitionId,
          // Raw quantities: `products.metric_units` is an information field
          // since §4.6, so a metric's products must share a unit.
          totalQty: sql<string>`coalesce(sum(${orderItems.quantity}), 0)`,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orders.id, orderItems.orderId))
        .innerJoin(products, eq(products.id, orderItems.productId))
        .innerJoin(
          facilityVerticalProfiles,
          eq(facilityVerticalProfiles.id, orders.facilityVerticalProfileId),
        )
        .innerJoin(
          productPotentialLinks,
          and(
            eq(productPotentialLinks.productId, orderItems.productId),
            eq(productPotentialLinks.verticalId, facilityVerticalProfiles.verticalId),
          ),
        )
        .where(
          and(
            eq(facilityVerticalProfiles.facilityId, input.facilityId),
            eq(facilityVerticalProfiles.verticalId, input.verticalId),
            // SALE and CONSIGNMENT (ADR 0003). This filtered SALE only while the
            // funnel counted both, so consigned stock was invisible here.
            inArray(orders.type, ["SALE", "CONSIGNMENT"]),
            inArray(orders.status, ["APPROVED", "INVOICED"]),
            gte(orders.orderedAt, input.rangeStart),
            lt(orders.orderedAt, input.rangeEnd),
            inArray(productPotentialLinks.definitionId, input.definitionIds),
          ),
        )
        .groupBy(productPotentialLinks.definitionId);

      return rows.map((row) => ({
        definitionId: row.definitionId,
        totalQty: Number(row.totalQty),
      }));
    },

    async listTheirs(input) {
      if (input.definitionIds.length === 0) return [];
      const rows = await database
        .selectDistinct({
          definitionId: facilityProductUsage.definitionId,
          productId: facilityProductUsage.productId,
          productName: products.name,
          quantity: facilityProductUsage.quantity,
          updatedAt: facilityProductUsage.updatedAt,
        })
        .from(facilityProductUsage)
        .innerJoin(products, eq(products.id, facilityProductUsage.productId))
        // Only products that still count toward the metric (§4.6), matching our
        // own side. For a competitor that is *derived*, not curated: nothing
        // links a competitor product to a definition — the catalogue screen
        // links our variants — so it counts when it is the equivalent of one of
        // ours that is linked. Joining `product_potential_links` directly, as
        // this once did, filtered out every competitor row there has ever been.
        .innerJoin(
          productEquivalences,
          eq(productEquivalences.competitorProductId, facilityProductUsage.productId),
        )
        .innerJoin(
          productPotentialLinks,
          and(
            eq(productPotentialLinks.productId, productEquivalences.productId),
            eq(productPotentialLinks.definitionId, facilityProductUsage.definitionId),
          ),
        )
        .where(
          and(
            eq(facilityProductUsage.facilityVerticalProfileId, input.profileId),
            inArray(facilityProductUsage.definitionId, input.definitionIds),
          ),
        );

      return rows.map((row) => ({
        definitionId: row.definitionId,
        productId: row.productId,
        productName: row.productName,
        quantity: Number(row.quantity),
        updatedAt: row.updatedAt,
      }));
    },


    async listExisting(input) {
      const rows = await database
        .select({
          definitionId: facilityMetricSnapshots.definitionId,
          oursQty: facilityMetricSnapshots.oursQty,
          theirsQty: facilityMetricSnapshots.theirsQty,
        })
        .from(facilityMetricSnapshots)
        .where(eq(facilityMetricSnapshots.facilityVerticalProfileId, input.profileId));
      return rows.map((row) => ({
        definitionId: row.definitionId,
        oursQty: Number(row.oursQty),
        theirsQty: Number(row.theirsQty),
      }));
    },

    async upsert(rows) {
      if (rows.length === 0) return;
      await database
        .insert(facilityMetricSnapshots)
        .values(
          rows.map((row) => ({
            facilityVerticalProfileId: row.profileId,
            definitionId: row.definitionId,
            verticalId: row.verticalId,
            oursQty: row.oursQty.toFixed(2),
            theirsQty: row.theirsQty.toFixed(2),
            computedAt: row.computedAt,
          })),
        )
        .onConflictDoUpdate({
          target: [
            facilityMetricSnapshots.facilityVerticalProfileId,
            facilityMetricSnapshots.definitionId,
          ],
          // Only the derived columns. `no_other_brands` and its provenance are
          // a rep's claim living on this row (§4.6) — a recompute that wrote
          // them would erase a person's assertion to refresh a cache.
          set: {
            oursQty: sql`excluded.ours_qty`,
            theirsQty: sql`excluded.theirs_qty`,
            computedAt: sql`excluded.computed_at`,
          },
        });
    },
  };
}

/**
 * The quantity standing for each competitor product of a metric.
 *
 * Shares the store's join rules so the clinic screen and the recompute cannot
 * disagree about which products belong to a metric — in particular that an
 * unlinked product stops counting on both sides.
 */
export async function listTheirsStanding(
  database: AnyDatabase,
  input: { profileId: number; definitionIds: number[] },
) {
  return createMetricSnapshotStore(database).listTheirs(input);
}

/**
 * Profiles whose inputs changed inside a window — the sweep's candidate set.
 *
 * A watermark, not a scan (spec 0013 §4.4). Half-open `[since, until)` so a row
 * on a boundary is claimed by exactly one run; keyset paging rather than OFFSET
 * because the sweep runs while writes are landing.
 */
export async function listProfilesWithChangedInputs(
  database: AnyDatabase,
  input: { since: Date; until: Date; afterProfileId: number; limit: number },
): Promise<number[]> {
  const changedByOrders = database
    .selectDistinct({ profileId: orders.facilityVerticalProfileId })
    .from(orders)
    .where(
      and(
        gte(orders.updatedAt, input.since),
        lt(orders.updatedAt, input.until),
        isNotNull(orders.facilityVerticalProfileId),
        gt(orders.facilityVerticalProfileId, input.afterProfileId),
      ),
    );

  const changedByUsage = database
    .selectDistinct({ profileId: facilityProductUsage.facilityVerticalProfileId })
    .from(facilityProductUsage)
    .where(
      and(
        gte(facilityProductUsage.updatedAt, input.since),
        lt(facilityProductUsage.updatedAt, input.until),
        gt(facilityProductUsage.facilityVerticalProfileId, input.afterProfileId),
      ),
    );

  const rows = await union(changedByOrders, changedByUsage)
    .orderBy(asc(orders.facilityVerticalProfileId))
    .limit(input.limit);

  return rows.map((row) => Number(row.profileId)).filter((id) => Number.isFinite(id));
}

/**
 * Every profile, keyset-paged — the backfill's candidate set.
 *
 * Deliberately not the watermark query with a null window: "recompute
 * everything" and "recompute what changed" are different intentions, and
 * collapsing them makes a full rebuild reachable by passing a wrong argument.
 */
export async function listAllProfileIds(
  database: AnyDatabase,
  input: { afterProfileId: number; limit: number },
): Promise<number[]> {
  const rows = await database
    .select({ id: facilityVerticalProfiles.id })
    .from(facilityVerticalProfiles)
    .where(gt(facilityVerticalProfiles.id, input.afterProfileId))
    .orderBy(asc(facilityVerticalProfiles.id))
    .limit(input.limit);
  return rows.map((row) => row.id);
}

/**
 * Our own quantity for a metric, broken down by product, over a date range.
 *
 * The same joins and predicates as `sumOurs` — ADR 0003's eligible order types
 * and statuses, the `metric_units` multiplication, and the per-linha link join —
 * grouped by product instead of by month. `sumOurs` answers "how much of this
 * metric did we sell"; this answers "which of our products was that".
 *
 * Deliberately a sibling rather than a parameter on `sumOurs`: that one feeds
 * the snapshot sweep, which stores month facts, and a shape that varies by
 * argument is how a caller ends up writing the wrong rows.
 */
export async function sumOursByProduct(
  database: AnyDatabase,
  input: {
    facilityId: number;
    verticalId: number;
    definitionIds: number[];
    rangeStart: Date;
    rangeEnd: Date;
  },
): Promise<
  Array<{ definitionId: number; productId: number; productName: string; totalQty: number }>
> {
  if (input.definitionIds.length === 0) return [];
  const rows = await database
    .select({
      definitionId: productPotentialLinks.definitionId,
      // products.id, not orderItems.productId: the column is still nullable
      // (spec 0013 §5 makes it NOT NULL), and the inner join already excludes
      // the null rows anyway.
      productId: products.id,
      productName: products.name,
      totalQty: sql<string>`coalesce(sum(${orderItems.quantity} * ${products.metricUnits}), 0)`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .innerJoin(products, eq(products.id, orderItems.productId))
    .innerJoin(
      facilityVerticalProfiles,
      eq(facilityVerticalProfiles.id, orders.facilityVerticalProfileId),
    )
    .innerJoin(
      productPotentialLinks,
      and(
        eq(productPotentialLinks.productId, orderItems.productId),
        eq(productPotentialLinks.verticalId, facilityVerticalProfiles.verticalId),
      ),
    )
    .where(
      and(
        eq(facilityVerticalProfiles.facilityId, input.facilityId),
        eq(facilityVerticalProfiles.verticalId, input.verticalId),
        inArray(orders.type, ["SALE", "CONSIGNMENT"]),
        inArray(orders.status, ["APPROVED", "INVOICED"]),
        gte(orders.orderedAt, input.rangeStart),
        lt(orders.orderedAt, input.rangeEnd),
        inArray(productPotentialLinks.definitionId, input.definitionIds),
      ),
    )
    .groupBy(productPotentialLinks.definitionId, products.id, products.name);

  return rows.map((row) => ({
    definitionId: row.definitionId,
    productId: row.productId,
    productName: row.productName,
    totalQty: Number(row.totalQty),
  }));
}


