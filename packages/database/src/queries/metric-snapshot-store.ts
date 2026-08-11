import { and, asc, eq, gt, gte, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { union } from "drizzle-orm/pg-core";
import {
  APPLICATION_TIMEZONE,
  type MetricSnapshotStore,
  type MonthKey,
} from "@atlasmed/facility-insights";
import type { AnyDatabase } from "../client";
import { facilityVerticalProfiles } from "../schema/public/facilities";
import { orderItems, orders } from "../schema/public/orders";
import { products } from "../schema/public/catalog";
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
          month: monthExpression(orders.orderedAt),
          // Metric units, not product units (spec 0013 §4.2). Summing raw
          // counted a box of five as one.
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
            // Links are per (product, vertical) since 0086, so the join must name
            // the vertical too — otherwise a product sold in two linhas
            // contributes its quantity to both metrics.
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
        .groupBy(productPotentialLinks.definitionId, monthExpression(orders.orderedAt));

      return rows.map((row) => ({
        definitionId: row.definitionId,
        month: row.month as MonthKey,
        totalQty: Number(row.totalQty),
      }));
    },

    async sumTheirs(input) {
      if (input.definitionIds.length === 0 || input.months.length === 0) return [];
      const rows = await database
        .select({
          definitionId: facilityProductUsage.definitionId,
          month: facilityProductUsage.month,
          quantity: facilityProductUsage.quantity,
          metricUnits: products.metricUnits,
        })
        .from(facilityProductUsage)
        .innerJoin(products, eq(products.id, facilityProductUsage.productId))
        .where(
          and(
            eq(facilityProductUsage.facilityVerticalProfileId, input.profileId),
            inArray(facilityProductUsage.definitionId, input.definitionIds),
            inArray(facilityProductUsage.month, input.months),
          ),
        );

      return rows.map((row) => ({
        definitionId: row.definitionId,
        month: row.month as MonthKey,
        // Symmetric with our own side: the rep enters product units and the
        // packaging factor is applied at read time, never pre-multiplied.
        metricQuantity: Number(row.quantity) * Number(row.metricUnits),
      }));
    },

    async listExisting(input) {
      if (input.months.length === 0) return [];
      const rows = await database
        .select({
          definitionId: facilityMetricSnapshots.definitionId,
          month: facilityMetricSnapshots.month,
          oursQty: facilityMetricSnapshots.oursQty,
          theirsQty: facilityMetricSnapshots.theirsQty,
        })
        .from(facilityMetricSnapshots)
        .where(
          and(
            eq(facilityMetricSnapshots.facilityVerticalProfileId, input.profileId),
            inArray(facilityMetricSnapshots.month, input.months),
          ),
        );
      return rows.map((row) => ({
        definitionId: row.definitionId,
        month: row.month as MonthKey,
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
            month: row.month,
            oursQty: row.oursQty.toFixed(2),
            theirsQty: row.theirsQty.toFixed(2),
            computedAt: row.computedAt,
          })),
        )
        .onConflictDoUpdate({
          target: [
            facilityMetricSnapshots.facilityVerticalProfileId,
            facilityMetricSnapshots.definitionId,
            facilityMetricSnapshots.month,
          ],
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
 * The calendar month an order belongs to, in São Paulo.
 *
 * `ordered_at` is `timestamp without time zone` holding UTC, so it is
 * interpreted as UTC and then read locally. Grouping in UTC would file an order
 * taken 31 March 22:00 local under April.
 */
function monthExpression(column: typeof orders.orderedAt) {
  return sql<string>`(date_trunc('month', ${column} at time zone 'UTC' at time zone ${sql.raw(`'${APPLICATION_TIMEZONE}'`)}))::date`;
}
