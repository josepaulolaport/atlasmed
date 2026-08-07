import {
  facilityPotentialValues,
  orderItems,
  orders,
  productPotentialDefinitions,
  productPotentialLinks,
  productVerticals,
  products,
} from "@atlasmed/database";
import { and, asc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
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
    sortOrder: row.sortOrder,
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzlePotentialRepository implements PotentialRepository {
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
    const rows = await db
      .select()
      .from(productPotentialDefinitions)
      .where(and(...conditions))
      .orderBy(
        asc(productPotentialDefinitions.sortOrder),
        asc(productPotentialDefinitions.label),
      );
    return rows.map(mapDefinition);
  }

  async findDefinitionById(
    id: number,
  ): Promise<PotentialDefinitionRecord | null> {
    const [row] = await db
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
    sortOrder: number;
  }): Promise<PotentialDefinitionRecord> {
    const [row] = await db
      .insert(productPotentialDefinitions)
      .values({
        verticalId: input.verticalId,
        key: input.key,
        label: input.label,
        sortOrder: input.sortOrder,
      })
      .returning();
    return mapDefinition(row!);
  }

  async updateDefinition(input: {
    id: number;
    label?: string;
    sortOrder?: number;
  }): Promise<PotentialDefinitionRecord | null> {
    const patch: Partial<typeof productPotentialDefinitions.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.label !== undefined) patch.label = input.label;
    if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;
    const [row] = await db
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
    const [row] = await db
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
    const rows = await db
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
    await db
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
    await db
      .delete(facilityPotentialValues)
      .where(
        and(
          eq(facilityPotentialValues.facilityId, input.facilityId),
          eq(facilityPotentialValues.definitionId, input.definitionId),
        ),
      );
  }

  async sumAtlasmedQtyByDefinition(input: {
    facilityId: number;
    definitionIds: number[];
    since: Date;
  }): Promise<DefinitionQtySum[]> {
    if (input.definitionIds.length === 0) return [];
    const rows = await db
      .select({
        definitionId: productPotentialLinks.definitionId,
        totalQty: sql<string>`coalesce(sum(${orderItems.quantity}), 0)`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .innerJoin(
        productPotentialLinks,
        eq(productPotentialLinks.productId, orderItems.productId),
      )
      .where(
        and(
          eq(orders.facilityId, input.facilityId),
          eq(orders.type, "SALE"),
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

  async linkProduct(input: {
    productId: number;
    definitionId: number;
  }): Promise<void> {
    await db
      .insert(productPotentialLinks)
      .values({
        productId: input.productId,
        definitionId: input.definitionId,
      })
      .onConflictDoUpdate({
        target: productPotentialLinks.productId,
        set: {
          definitionId: input.definitionId,
          updatedAt: new Date(),
        },
      });
  }

  async unlinkProduct(productId: number): Promise<boolean> {
    const deleted = await db
      .delete(productPotentialLinks)
      .where(eq(productPotentialLinks.productId, productId))
      .returning({ productId: productPotentialLinks.productId });
    return deleted.length > 0;
  }

  async listProductsForDefinition(
    definitionId: number,
  ): Promise<ProductPotentialLinkRecord[]> {
    const rows = await db
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
    const [row] = await db
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

  async findLinkByProductId(
    productId: number,
  ): Promise<{ productId: number; definitionId: number } | null> {
    const [row] = await db
      .select({
        productId: productPotentialLinks.productId,
        definitionId: productPotentialLinks.definitionId,
      })
      .from(productPotentialLinks)
      .where(eq(productPotentialLinks.productId, productId))
      .limit(1);
    return row ?? null;
  }
}
