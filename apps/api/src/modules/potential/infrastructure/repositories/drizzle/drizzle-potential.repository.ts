import {
  facilityMetricSnapshots,
  facilityProductUsage,
  facilityVerticalProfiles,
  orderItems,
  orders,
  productPotentialDefinitions,
  productPotentialLinks,
  productVerticals,
  products,
} from "@atlasmed/database";
import { and, asc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import type { Database } from "@atlasmed/database";
import { APPLICATION_TIMEZONE, type MonthKey } from "@atlasmed/facility-insights";
import { db } from "../../../../../infrastructure/database/db";
import type {
  DefinitionMonthQtySum,
  MetricSnapshotWrite,
  ProfileRecord,
  StoredMetricSnapshot,
  FacilityProductUsageRecord,
  PotentialDefinitionRecord,
  PotentialRepository,
  ProductPotentialLinkRecord,
} from "../../../application/interfaces/potential.repository.interface";

function mapDefinition(
  row: typeof productPotentialDefinitions.$inferSelect,
): PotentialDefinitionRecord {
  return {
    id: row.id,
    verticalId: row.verticalId,
    key: row.key,
    label: row.label,
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzlePotentialRepository implements PotentialRepository {
  /**
   * Injectable so the metric arithmetic can be asserted inside a rolled-back
   * transaction against real rows. Defaults to the shared client, so every
   * existing caller is unchanged.
   */
  constructor(private readonly database: Database = db) {}

  async listDefinitions(input: {
    verticalId: number;
    includeDeleted?: boolean;
  }): Promise<PotentialDefinitionRecord[]> {
    const conditions = [
      eq(productPotentialDefinitions.verticalId, input.verticalId),
    ];
    if (!input.includeDeleted) {
      conditions.push(isNull(productPotentialDefinitions.deletedAt));
    }
    const rows = await this.database
      .select()
      .from(productPotentialDefinitions)
      .where(and(...conditions))
      .orderBy(asc(productPotentialDefinitions.label));
    return rows.map(mapDefinition);
  }

  async findDefinitionById(
    id: number,
  ): Promise<PotentialDefinitionRecord | null> {
    const [row] = await this.database
      .select()
      .from(productPotentialDefinitions)
      .where(eq(productPotentialDefinitions.id, id))
      .limit(1);
    return row ? mapDefinition(row) : null;
  }

  async createDefinition(input: {
    verticalId: number;
    key: string;
    label: string;
  }): Promise<PotentialDefinitionRecord> {
    const [row] = await this.database
      .insert(productPotentialDefinitions)
      .values({
        verticalId: input.verticalId,
        key: input.key,
        label: input.label,
      })
      .returning();
    return mapDefinition(row!);
  }

  async updateDefinition(input: {
    id: number;
    label?: string;
  }): Promise<PotentialDefinitionRecord | null> {
    const patch: Partial<typeof productPotentialDefinitions.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.label !== undefined) patch.label = input.label;
    const [row] = await this.database
      .update(productPotentialDefinitions)
      .set(patch)
      .where(
        and(
          eq(productPotentialDefinitions.id, input.id),
          isNull(productPotentialDefinitions.deletedAt),
        ),
      )
      .returning();
    return row ? mapDefinition(row) : null;
  }

  async softDeleteDefinition(id: number): Promise<boolean> {
    const [row] = await this.database
      .update(productPotentialDefinitions)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(productPotentialDefinitions.id, id),
          isNull(productPotentialDefinitions.deletedAt),
        ),
      )
      .returning({ id: productPotentialDefinitions.id });
    return Boolean(row);
  }

  /** Resolves the commercial unit a clinic's linha corresponds to. */
  async findProfileId(input: {
    facilityId: number;
    verticalId: number;
  }): Promise<number | null> {
    const [row] = await this.database
      .select({ id: facilityVerticalProfiles.id })
      .from(facilityVerticalProfiles)
      .where(
        and(
          eq(facilityVerticalProfiles.facilityId, input.facilityId),
          eq(facilityVerticalProfiles.verticalId, input.verticalId),
        ),
      )
      .limit(1);
    return row?.id ?? null;
  }

  /** The clinic and linha a profile belongs to — the recompute handler's entry point. */
  async findProfileById(profileId: number): Promise<ProfileRecord | null> {
    const [row] = await this.database
      .select({
        id: facilityVerticalProfiles.id,
        facilityId: facilityVerticalProfiles.facilityId,
        verticalId: facilityVerticalProfiles.verticalId,
      })
      .from(facilityVerticalProfiles)
      .where(eq(facilityVerticalProfiles.id, profileId))
      .limit(1);
    return row ?? null;
  }

  /**
   * Writes the computed rows, replacing whatever was there.
   *
   * A whole-row replacement, never a delta: that is what makes at-least-once
   * delivery safe, and what lets the sweep and the trigger race without either
   * corrupting the other (spec 0013 §4.4).
   */
  async upsertMetricSnapshots(rows: MetricSnapshotWrite[]): Promise<void> {
    if (rows.length === 0) return;
    await this.database
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
  }

  /**
   * The snapshots that already exist for these months, with their values.
   *
   * Serves two jobs at once. The keys let the handler zero a row whose inputs
   * have since disappeared — an order deleted, a usage row removed — because
   * recomputing only the cells that still have inputs would leave the old figure
   * standing. The values let it report how many rows it actually *changed*,
   * which is the only signal that a trigger was lost.
   */
  async listMetricSnapshotValues(input: {
    profileId: number;
    months: MonthKey[];
  }): Promise<StoredMetricSnapshot[]> {
    if (input.months.length === 0) return [];
    const rows = await this.database
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
      month: row.month,
      oursQty: Number(row.oursQty),
      theirsQty: Number(row.theirsQty),
    }));
  }

  /**
   * Competitor quantities for the given months.
   *
   * `months` is explicit rather than "the latest": the read path averages a
   * trailing window and the recompute handler wants exactly one month, and
   * neither should be expressed as a `LIMIT` over an implicit ordering.
   */
  async listUsage(input: {
    profileId: number;
    definitionIds: number[];
    months: MonthKey[];
  }): Promise<FacilityProductUsageRecord[]> {
    if (input.definitionIds.length === 0 || input.months.length === 0) return [];
    const rows = await this.database
      .select({
        definitionId: facilityProductUsage.definitionId,
        productId: facilityProductUsage.productId,
        productName: products.name,
        month: facilityProductUsage.month,
        quantity: facilityProductUsage.quantity,
        metricUnits: products.metricUnits,
        updatedAt: facilityProductUsage.updatedAt,
      })
      .from(facilityProductUsage)
      .innerJoin(products, eq(products.id, facilityProductUsage.productId))
      .where(
        and(
          eq(facilityProductUsage.facilityVerticalProfileId, input.profileId),
          inArray(facilityProductUsage.definitionId, input.definitionIds),
          inArray(facilityProductUsage.month, input.months),
        ),
      )
      .orderBy(asc(facilityProductUsage.month), asc(products.name));

    return rows.map((row) => ({
      definitionId: row.definitionId,
      productId: row.productId,
      productName: row.productName,
      month: row.month,
      /** Product units, as the rep entered them. */
      quantity: Number(row.quantity),
      /** Metric units — quantity × the product's packaging factor. */
      metricQuantity: Number(row.quantity) * Number(row.metricUnits),
      updatedAt: row.updatedAt,
    }));
  }

  /**
   * Sets one competitor quantity, replacing any previous figure for the same
   * (profile, definition, product, month). The rep supplies only the number; the
   * vertical comes from the definition, so the two composite foreign keys cannot
   * disagree.
   *
   * The month is part of the key because the rep's answer is an observation
   * about a month (spec 0013 §4.1, amended 2026-08-11) — overwriting it would
   * silently rewrite what was true in every earlier month.
   */
  async upsertUsage(input: {
    profileId: number;
    definitionId: number;
    verticalId: number;
    productId: number;
    month: MonthKey;
    quantity: number;
    updatedByUserId: number;
  }): Promise<void> {
    await this.database
      .insert(facilityProductUsage)
      .values({
        facilityVerticalProfileId: input.profileId,
        definitionId: input.definitionId,
        verticalId: input.verticalId,
        productId: input.productId,
        month: input.month,
        quantity: String(input.quantity),
        updatedByUserId: input.updatedByUserId,
      })
      .onConflictDoUpdate({
        target: [
          facilityProductUsage.facilityVerticalProfileId,
          facilityProductUsage.definitionId,
          facilityProductUsage.productId,
          facilityProductUsage.month,
        ],
        set: {
          quantity: String(input.quantity),
          updatedByUserId: input.updatedByUserId,
          updatedAt: new Date(),
        },
      });
  }

  async deleteUsage(input: {
    profileId: number;
    definitionId: number;
    productId: number;
    month: MonthKey;
  }): Promise<boolean> {
    const deleted = await this.database
      .delete(facilityProductUsage)
      .where(
        and(
          eq(facilityProductUsage.facilityVerticalProfileId, input.profileId),
          eq(facilityProductUsage.definitionId, input.definitionId),
          eq(facilityProductUsage.productId, input.productId),
          eq(facilityProductUsage.month, input.month),
        ),
      )
      .returning({ id: facilityProductUsage.id });
    return deleted.length > 0;
  }

  /**
   * Penetration numerator.
   *
   * Previously filtered `orders.facility_id` alone and ignored the vertical
   * entirely, so a clinic active in two linhas counted *every* linha's sales
   * toward each one's penetration. Spec 0010 §4 predicted this would be fixed by
   * the re-keying, and it is: orders now carry the profile, and the profile is
   * what a vertical means.
   */
  async sumAtlasmedQtyByDefinitionAndMonth(input: {
    facilityId: number;
    verticalId: number;
    definitionIds: number[];
    /** Inclusive lower bound — the UTC instant of local midnight on the 1st. */
    rangeStart: Date;
    /** Exclusive upper bound — the same instant for the month after the last. */
    rangeEnd: Date;
  }): Promise<DefinitionMonthQtySum[]> {
    if (input.definitionIds.length === 0) return [];
    const rows = await this.database
      .select({
        definitionId: productPotentialLinks.definitionId,
        // `ordered_at` is `timestamp without time zone` holding UTC, so it is
        // interpreted as UTC and then read in São Paulo — the same two-step the
        // purchase-recurrence query uses. Grouping in UTC would file an order
        // taken 31 March 22:00 local under April.
        month: sql<string>`(date_trunc('month', ${orders.orderedAt} at time zone 'UTC' at time zone ${sql.raw(`'${APPLICATION_TIMEZONE}'`)}))::date`,
        // Metric units, not product units (spec 0013 §4.2). Summing quantity raw
        // counted a box of five as one, so ten boxes read as ten ampoules
        // instead of fifty. Every share figure was understated by the packaging
        // factor, plausibly enough that nobody noticed.
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
          // The link is per (product, vertical) since 0086, so the join must
          // name the vertical too — otherwise a product sold in two linhas
          // contributes its quantity to both metrics.
          eq(productPotentialLinks.verticalId, facilityVerticalProfiles.verticalId),
        ),
      )
      .where(
        and(
          eq(facilityVerticalProfiles.facilityId, input.facilityId),
          eq(facilityVerticalProfiles.verticalId, input.verticalId),
          // SALE and CONSIGNMENT, per ADR 0003 and spec 0013 §4.3. This query
          // filtered SALE only while the funnel counted both, so consigned
          // stock was invisible here and visible there.
          inArray(orders.type, ["SALE", "CONSIGNMENT"]),
          inArray(orders.status, ["APPROVED", "INVOICED"]),
          // Half-open calendar month, São Paulo boundaries (spec 0013 §4.3).
          // This replaced `ordered_at >= now() - 90 days`, which had no upper
          // bound at all — future-dated orders counted toward the current
          // figure — and which made the value depend on the clock, so the same
          // month could never be recomputed to the same number.
          gte(orders.orderedAt, input.rangeStart),
          lt(orders.orderedAt, input.rangeEnd),
          inArray(productPotentialLinks.definitionId, input.definitionIds),
        ),
      )
      .groupBy(
        productPotentialLinks.definitionId,
        sql`date_trunc('month', ${orders.orderedAt} at time zone 'UTC' at time zone ${sql.raw(`'${APPLICATION_TIMEZONE}'`)})`,
      );

    return rows.map((row) => ({
      definitionId: row.definitionId,
      month: row.month,
      totalQty: Number(row.totalQty),
    }));
  }

  /**
   * Links a product to a metric, replacing whatever it was linked to *in that
   * linha*. Its links in other linhas are untouched.
   *
   * The conflict target is (product_id, vertical_id) rather than the primary
   * key: re-linking a product within a linha should move it to the new metric,
   * not add a second one. That is precisely the rule 0086 put in the schema.
   */
  async linkProduct(input: {
    productId: number;
    definitionId: number;
    verticalId: number;
  }): Promise<void> {
    await this.database
      .insert(productPotentialLinks)
      .values({
        productId: input.productId,
        definitionId: input.definitionId,
        verticalId: input.verticalId,
      })
      .onConflictDoUpdate({
        target: [productPotentialLinks.productId, productPotentialLinks.verticalId],
        set: {
          definitionId: input.definitionId,
          updatedAt: new Date(),
        },
      });
  }

  async unlinkProduct(input: {
    productId: number;
    definitionId: number;
  }): Promise<boolean> {
    const deleted = await this.database
      .delete(productPotentialLinks)
      .where(
        and(
          eq(productPotentialLinks.productId, input.productId),
          eq(productPotentialLinks.definitionId, input.definitionId),
        ),
      )
      .returning({ productId: productPotentialLinks.productId });
    return deleted.length > 0;
  }

  async listProductsForDefinition(
    definitionId: number,
  ): Promise<ProductPotentialLinkRecord[]> {
    const rows = await this.database
      .select({
        productId: productPotentialLinks.productId,
        definitionId: productPotentialLinks.definitionId,
        productName: products.name,
        productCode: products.code,
      })
      .from(productPotentialLinks)
      .innerJoin(products, eq(products.id, productPotentialLinks.productId))
      .where(eq(productPotentialLinks.definitionId, definitionId))
      .orderBy(asc(products.name));
    return rows;
  }

  async productBelongsToVertical(input: {
    productId: number;
    verticalId: number;
  }): Promise<boolean> {
    const [row] = await this.database
      .select({ id: productVerticals.id })
      .from(productVerticals)
      .where(
        and(
          eq(productVerticals.productId, input.productId),
          eq(productVerticals.verticalId, input.verticalId),
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  /**
   * One specific link. Takes the definition as well as the product because a
   * product may now be linked in several linhas — asking by product alone no
   * longer identifies a row.
   */
  async findLink(input: {
    productId: number;
    definitionId: number;
  }): Promise<{ productId: number; definitionId: number; verticalId: number } | null> {
    const [row] = await this.database
      .select({
        productId: productPotentialLinks.productId,
        definitionId: productPotentialLinks.definitionId,
        verticalId: productPotentialLinks.verticalId,
      })
      .from(productPotentialLinks)
      .where(
        and(
          eq(productPotentialLinks.productId, input.productId),
          eq(productPotentialLinks.definitionId, input.definitionId),
        ),
      )
      .limit(1);
    return row ?? null;
  }
}
