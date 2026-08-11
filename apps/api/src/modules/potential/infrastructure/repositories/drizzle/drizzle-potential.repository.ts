import {
  facilityPotentialValues,
  facilityVerticalProfiles,
  orderItems,
  orders,
  productPotentialDefinitions,
  productPotentialLinks,
  productVerticals,
  products,
} from "@atlasmed/database";
import { and, asc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import type { Database } from "@atlasmed/database";
import { db } from "../../../../../infrastructure/database/db";
import type {
  DefinitionQtySum,
  FacilityPotentialValueRecord,
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

  async listFacilityValues(input: {
    facilityId: number;
    definitionIds: number[];
  }): Promise<FacilityPotentialValueRecord[]> {
    if (input.definitionIds.length === 0) return [];
    const rows = await this.database
      .select()
      .from(facilityPotentialValues)
      .where(
        and(
          eq(facilityPotentialValues.facilityId, input.facilityId),
          inArray(facilityPotentialValues.definitionId, input.definitionIds),
        ),
      );
    return rows.map((row) => ({
      facilityId: row.facilityId,
      definitionId: row.definitionId,
      quantity: Number(row.quantity),
      updatedByUserId: row.updatedByUserId,
      updatedAt: row.updatedAt,
    }));
  }

  async upsertFacilityValue(input: {
    facilityId: number;
    definitionId: number;
    quantity: number;
    updatedByUserId: number;
  }): Promise<void> {
    await this.database
      .insert(facilityPotentialValues)
      .values({
        facilityId: input.facilityId,
        definitionId: input.definitionId,
        quantity: String(input.quantity),
        updatedByUserId: input.updatedByUserId,
      })
      .onConflictDoUpdate({
        target: [
          facilityPotentialValues.facilityId,
          facilityPotentialValues.definitionId,
        ],
        set: {
          quantity: String(input.quantity),
          updatedByUserId: input.updatedByUserId,
          updatedAt: new Date(),
        },
      });
  }

  async deleteFacilityValue(input: {
    facilityId: number;
    definitionId: number;
  }): Promise<void> {
    await this.database
      .delete(facilityPotentialValues)
      .where(
        and(
          eq(facilityPotentialValues.facilityId, input.facilityId),
          eq(facilityPotentialValues.definitionId, input.definitionId),
        ),
      );
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
  async sumAtlasmedQtyByDefinition(input: {
    facilityId: number;
    verticalId: number;
    definitionIds: number[];
    since: Date;
  }): Promise<DefinitionQtySum[]> {
    if (input.definitionIds.length === 0) return [];
    const rows = await this.database
      .select({
        definitionId: productPotentialLinks.definitionId,
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
          gte(orders.orderedAt, input.since),
          inArray(productPotentialLinks.definitionId, input.definitionIds),
        ),
      )
      .groupBy(productPotentialLinks.definitionId);

    return rows.map((row) => ({
      definitionId: row.definitionId,
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
