import {
  facilities,
  facilityVerticalProfiles,
  orderItems,
  orders,
  productVerticals,
  products,
  professionals,
  users,
} from "@atlasmed/database";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import type {
  CreateOrderInput,
  OrderDetailRecord,
  OrderRepository,
  OrderScopeFilter,
  OrderStatus,
} from "../../../application/interfaces/order.repository.interface";

function scopeCondition(scope: OrderScopeFilter) {
  if (scope.isGlobal) return undefined;
  return inArray(orders.facilityId, scope.facilityIds?.length ? scope.facilityIds : [-1]);
}

function personName(firstName: string | null, lastName: string | null, fallback: string | null) {
  return [firstName, lastName].filter(Boolean).join(" ") || fallback || null;
}

export class DrizzleOrderRepository implements OrderRepository {
  async findAll(input: {
    page: number;
    limit: number;
    statuses?: OrderStatus[];
    facilityId?: number;
    verticalIds: number[];
    sellerId?: number;
    includeItemPreviews?: boolean;
    scope: OrderScopeFilter;
  }) {
    if (input.verticalIds.length === 0) {
      return { orders: [], total: 0 };
    }

    const conditions = [
      scopeCondition(input.scope),
      inArray(orders.verticalId, input.verticalIds),
    ];
    if (input.statuses?.length) conditions.push(inArray(orders.status, input.statuses));
    if (input.facilityId) conditions.push(eq(orders.facilityId, input.facilityId));
    if (input.sellerId) conditions.push(eq(orders.sellerId, input.sellerId));
    const where = and(...conditions);
    const skip = (input.page - 1) * input.limit;

    const [rows, counts] = await Promise.all([
      db
        .select({
          id: orders.id,
          idAvulsaEmultec: orders.idAvulsaEmultec,
          verticalId: orders.verticalId,
          status: orders.status,
          type: orders.type,
          orderedAt: orders.orderedAt,
          createdAt: orders.createdAt,
          freight: orders.freight,
          facilityId: facilities.id,
          facilityName: facilities.displayName,
          professionalId: professionals.id,
          professionalFirstName: professionals.firstName,
          professionalLastName: professionals.lastName,
          professionalFullName: professionals.fullName,
          sellerId: users.id,
          sellerFirstName: users.firstName,
          sellerLastName: users.lastName,
          itemCount: sql<number>`cast(count(${orderItems.id}) as int)`,
          itemsTotal: sql<string>`coalesce(sum(${orderItems.quantity} * ${orderItems.unitPrice}), 0)`,
        })
        .from(orders)
        .innerJoin(facilities, eq(facilities.id, orders.facilityId))
        .leftJoin(professionals, eq(professionals.id, orders.professionalId))
        .leftJoin(users, eq(users.id, orders.sellerId))
        .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
        .where(where)
        .groupBy(
          orders.id,
          facilities.id,
          professionals.id,
          users.id
        )
        .orderBy(desc(orders.orderedAt), desc(orders.createdAt))
        .offset(skip)
        .limit(input.limit),
      db.select({ count: sql<number>`cast(count(*) as int)` }).from(orders).where(where),
    ]);

    const previewsByOrderId = input.includeItemPreviews && rows.length > 0
      ? await this.loadItemPreviews(rows.map((row) => row.id))
      : new Map<number, Array<{ productName: string; quantity: number; unitPrice: number }>>();

    return {
      orders: rows.map((row) => ({
        id: row.id,
        idAvulsaEmultec: row.idAvulsaEmultec,
        verticalId: row.verticalId,
        status: row.status,
        type: row.type,
        orderedAt: row.orderedAt,
        createdAt: row.createdAt,
        freight: Number(row.freight),
        facility: { id: row.facilityId, name: row.facilityName },
        professional: row.professionalId
          ? {
              id: row.professionalId,
              name: personName(
                row.professionalFirstName,
                row.professionalLastName,
                row.professionalFullName
              ) ?? String(row.professionalId),
            }
          : null,
        seller: row.sellerId
          ? {
              id: row.sellerId,
              name: personName(row.sellerFirstName, row.sellerLastName, null) ?? String(row.sellerId),
            }
          : null,
        itemCount: row.itemCount,
        itemsTotal: Number(row.itemsTotal),
        itemPreviews: previewsByOrderId.get(row.id) ?? [],
      })),
      total: counts[0]?.count ?? 0,
    };
  }

  private async loadItemPreviews(orderIds: number[]) {
    const rows = await db
      .select({
        orderId: orderItems.orderId,
        productName: products.name,
        quantity: orderItems.quantity,
        unitPrice: orderItems.unitPrice,
        createdAt: orderItems.createdAt,
      })
      .from(orderItems)
      .leftJoin(products, eq(products.id, orderItems.productId))
      .where(inArray(orderItems.orderId, orderIds))
      .orderBy(orderItems.createdAt, orderItems.id);

    const previews = new Map<
      number,
      Array<{ productName: string; quantity: number; unitPrice: number }>
    >();
    for (const row of rows) {
      const bucket = previews.get(row.orderId) ?? [];
      if (bucket.length >= 2) continue;
      bucket.push({
        productName: row.productName?.trim() || "Produto",
        quantity: Number(row.quantity),
        unitPrice: Number(row.unitPrice),
      });
      previews.set(row.orderId, bucket);
    }
    return previews;
  }

  async findById(id: number): Promise<OrderDetailRecord | null> {
    const [order] = await db
      .select({
        order: orders,
        facilityId: facilities.id,
        facilityName: facilities.displayName,
        professionalId: professionals.id,
        professionalFirstName: professionals.firstName,
        professionalLastName: professionals.lastName,
        professionalFullName: professionals.fullName,
        sellerId: users.id,
        sellerFirstName: users.firstName,
        sellerLastName: users.lastName,
      })
      .from(orders)
      .innerJoin(facilities, eq(facilities.id, orders.facilityId))
      .leftJoin(professionals, eq(professionals.id, orders.professionalId))
      .leftJoin(users, eq(users.id, orders.sellerId))
      .where(eq(orders.id, id))
      .limit(1);

    if (!order) return null;

    const items = await db
      .select({ item: orderItems, productId: products.id, productName: products.name, productCode: products.code })
      .from(orderItems)
      .leftJoin(products, eq(products.id, orderItems.productId))
      .where(eq(orderItems.orderId, id))
      .orderBy(orderItems.createdAt, orderItems.id);

    return {
      id: order.order.id,
      idAvulsaEmultec: order.order.idAvulsaEmultec,
      verticalId: order.order.verticalId,
      status: order.order.status,
      type: order.order.type,
      orderedAt: order.order.orderedAt,
      createdAt: order.order.createdAt,
      updatedAt: order.order.updatedAt,
      notes: order.order.notes,
      currency: order.order.currency,
      finalizedById: order.order.finalizedById,
      finalizedAt: order.order.finalizedAt,
      rejectedById: order.order.rejectedById,
      rejectionReason: order.order.rejectionReason,
      noBillingById: order.order.noBillingById,
      noBillingAt: order.order.noBillingAt,
      noBillingNotes: order.order.noBillingNotes,
      expenseAuthorizedById: order.order.expenseAuthorizedById,
      expenseAuthorizedAt: order.order.expenseAuthorizedAt,
      facility: { id: order.facilityId, name: order.facilityName },
      professional: order.professionalId
        ? {
            id: order.professionalId,
            name: personName(
              order.professionalFirstName,
              order.professionalLastName,
              order.professionalFullName
            ) ?? String(order.professionalId),
          }
        : null,
      seller: order.sellerId
        ? {
            id: order.sellerId,
            name: personName(order.sellerFirstName, order.sellerLastName, null) ?? String(order.sellerId),
          }
        : null,
      freight: Number(order.order.freight),
      grossWeight: Number(order.order.grossWeight),
      netWeight: Number(order.order.netWeight),
      usdExchangeRate: null,
      surgeryType: null,
      surgerySubtype: null,
      items: items.map(({ item, productId, productName, productCode }) => ({
        id: item.id,
        idAvulsaItemEmultec: item.idAvulsaItemEmultec,
        idProdutoEmultec: item.idProdutoEmultec,
        product: productId
          ? { id: productId, name: productName ?? String(productId), code: productCode ?? "" }
          : null,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        usdPrice: item.usdPrice == null ? null : Number(item.usdPrice),
        batchNumber: item.batchNumber,
        writtenOff: item.writtenOff,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    };
  }

  async hasActiveFacilityVerticalProfile(
    facilityId: number,
    verticalId: number
  ): Promise<boolean> {
    const [row] = await db
      .select({ id: facilityVerticalProfiles.id })
      .from(facilityVerticalProfiles)
      .where(
        and(
          eq(facilityVerticalProfiles.facilityId, facilityId),
          eq(facilityVerticalProfiles.verticalId, verticalId),
          eq(facilityVerticalProfiles.isActive, true)
        )
      )
      .limit(1);
    return Boolean(row);
  }

  async findProductIdsInVertical(
    productIds: number[],
    verticalId: number
  ): Promise<number[]> {
    if (productIds.length === 0) return [];
    const rows = await db
      .select({ productId: productVerticals.productId })
      .from(productVerticals)
      .where(
        and(
          inArray(productVerticals.productId, productIds),
          eq(productVerticals.verticalId, verticalId)
        )
      );
    return rows.map((row) => row.productId);
  }

  async findProductUnitPrices(productIds: number[]): Promise<Map<number, number>> {
    if (productIds.length === 0) return new Map();
    const rows = await db
      .select({ id: products.id, price: products.price })
      .from(products)
      .where(inArray(products.id, productIds));
    return new Map(rows.map((row) => [row.id, Number(row.price)]));
  }

  async create(input: CreateOrderInput): Promise<OrderDetailRecord> {
    const orderId = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(orders)
        .values({
          facilityId: input.facilityId,
          verticalId: input.verticalId,
          sellerId: input.sellerId,
          professionalId: input.professionalId ?? null,
          status: (input.status ?? "PENDING") as OrderStatus,
          type: (input.type ?? "SALE") as "SALE" | "CONSIGNMENT" | "DONATION" | "OTHER",
          notes: input.notes ?? null,
          freight: String(input.freight ?? 0),
          orderedAt: input.orderedAt ?? new Date(),
        })
        .returning({ id: orders.id });

      if (!created) throw new Error("Failed to insert order");

      await tx.insert(orderItems).values(
        input.items.map((item) => ({
          orderId: created.id,
          productId: item.productId,
          quantity: String(item.quantity),
          unitPrice: String(item.unitPrice ?? 0),
        }))
      );

      return created.id;
    });

    const detail = await this.findById(orderId);
    if (!detail) throw new Error("Order created but not found");
    return detail;
  }
}
