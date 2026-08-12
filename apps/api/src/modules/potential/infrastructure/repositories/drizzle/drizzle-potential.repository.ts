import {
  facilityProductUsage,
  facilityVerticalProfiles,
  productPotentialDefinitions,
  productPotentialLinks,
  productVerticals,
  products,
} from "@atlasmed/database";
import { createMetricSnapshotStore, latestTheirsByProduct, sumOursByProduct, type Database } from "@atlasmed/database";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { MonthKey } from "@atlasmed/facility-insights";
import { db } from "../../../../../infrastructure/database/db";
import type {
  DefinitionMonthQtySum,
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

  /** Stored snapshots — delegated, so the read path and the sweep agree. */
  async listMetricSnapshots(input: {
    profileId: number;
    months: MonthKey[];
  }) {
    return createMetricSnapshotStore(this.database).listExisting(input);
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

  async deleteUsageForProduct(input: {
    profileId: number;
    definitionId: number;
    productId: number;
  }): Promise<MonthKey[]> {
    const deleted = await this.database
      .delete(facilityProductUsage)
      .where(
        and(
          eq(facilityProductUsage.facilityVerticalProfileId, input.profileId),
          eq(facilityProductUsage.definitionId, input.definitionId),
          eq(facilityProductUsage.productId, input.productId),
        ),
      )
      .returning({ month: facilityProductUsage.month });
    return deleted.map((row) => row.month as MonthKey);
  }

  /**
   * Our quantity per (metric, calendar month), in metric units.
   *
   * Delegates to the shared store in `@atlasmed/database`: the reconciliation
   * sweep runs the identical query from the Temporal worker, and this query is
   * not plumbing — it encodes ADR 0003's eligible statuses and types, the
   * `metric_units` multiplication and the São Paulo month boundary, every one of
   * which was silently wrong at some point before P4-1.
   */
  async sumAtlasmedQtyByDefinitionAndMonth(input: {
    facilityId: number;
    verticalId: number;
    definitionIds: number[];
    rangeStart: Date;
    rangeEnd: Date;
  }): Promise<DefinitionMonthQtySum[]> {
    return createMetricSnapshotStore(this.database).sumOurs(input);
  }

  async sumAtlasmedQtyByDefinitionAndProduct(input: {
    facilityId: number;
    verticalId: number;
    definitionIds: number[];
    rangeStart: Date;
    rangeEnd: Date;
  }) {
    return sumOursByProduct(this.database, input);
  }

  async listLatestUsageByProduct(input: {
    profileId: number;
    definitionIds: number[];
  }) {
    return latestTheirsByProduct(this.database, input);
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
