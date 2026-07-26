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
  return inArray(orders.facilityId, scope.facilityIds?.length ? scope.facilityIds : ["__none__"]);
}

function personName(firstName: string | null, lastName: string | null, fallback: string | null) {
  return [firstName, lastName].filter(Boolean).join(" ") || fallback || null;
}

export class DrizzleOrderRepository implements OrderRepository {
  async findAll(input: {
    page: number;
    limit: number;
    statuses?: OrderStatus[];
    facilityId?: string;
    verticalIds: string[];
    sellerId?: string;
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
          legacyId: orders.legacyId,
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
      : new Map<string, Array<{ productName: string; quantity: number; unitPrice: number }>>();

    return {
      orders: rows.map((row) => ({
        id: row.id,
        legacyId: row.legacyId,
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
              ) ?? row.professionalId,
            }
          : null,
        seller: row.sellerId
          ? {
              id: row.sellerId,
              name: personName(row.sellerFirstName, row.sellerLastName, null) ?? row.sellerId,
            }
          : null,
        itemCount: row.itemCount,
        itemsTotal: Number(row.itemsTotal),
        itemPreviews: previewsByOrderId.get(row.id) ?? [],
      })),
      total: counts[0]?.count ?? 0,
    };
  }

  private async loadItemPreviews(orderIds: string[]) {
    const rows = await db
      .select({
        orderId: orderItems.orderId,
        productName: products.name,
        quantity: orderItems.quantity,
        unitPrice: orderItems.unitPrice,
        lineNumber: orderItems.lineNumber,
        createdAt: orderItems.createdAt,
      })
      .from(orderItems)
      .leftJoin(products, eq(products.id, orderItems.productId))
      .where(inArray(orderItems.orderId, orderIds))
      .orderBy(orderItems.lineNumber, orderItems.createdAt);

    const previews = new Map<
      string,
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

  async findById(id: string): Promise<OrderDetailRecord | null> {
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
      .orderBy(orderItems.lineNumber, orderItems.createdAt);

    return {
      ...order.order,
      status: order.order.status,
      facility: { id: order.facilityId, name: order.facilityName },
      professional: order.professionalId
        ? {
            id: order.professionalId,
            name: personName(
              order.professionalFirstName,
              order.professionalLastName,
              order.professionalFullName
            ) ?? order.professionalId,
          }
        : null,
      seller: order.sellerId
        ? {
            id: order.sellerId,
            name: personName(order.sellerFirstName, order.sellerLastName, null) ?? order.sellerId,
          }
        : null,
      freight: Number(order.order.freight),
      grossWeight: Number(order.order.grossWeight),
      netWeight: Number(order.order.netWeight),
      usdExchangeRate: order.order.usdExchangeRate == null ? null : Number(order.order.usdExchangeRate),
      items: items.map(({ item, productId, productName, productCode }) => ({
        ...item,
        product: productId
          ? { id: productId, name: productName ?? productId, code: productCode ?? "" }
          : null,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        usdPrice: item.usdPrice == null ? null : Number(item.usdPrice),
      })),
    };
  }

  async hasActiveFacilityVerticalProfile(
    facilityId: string,
    verticalId: string
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
    productIds: string[],
    verticalId: string
  ): Promise<string[]> {
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

  async findProductUnitPrices(productIds: string[]): Promise<Map<string, number>> {
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
        input.items.map((item, index) => ({
          orderId: created.id,
          productId: item.productId,
          lineNumber: index + 1,
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
