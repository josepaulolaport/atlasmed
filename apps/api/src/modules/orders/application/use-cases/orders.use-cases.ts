import {
  assertResourceInScope,
  ForbiddenError,
  Role,
  type ScopeContext,
} from "@atlasmed/access";
import { resolveVerticalIds } from "../../../access/application/services/vertical-access.service";
import type {
  OrderDetailRecord,
  OrderRepository,
  OrderStatus,
} from "../interfaces/order.repository.interface";

function iso(date: Date | null): string | null {
  return date?.toISOString() ?? null;
}

function serializeListOrder(order: Awaited<ReturnType<OrderRepository["findAll"]>>["orders"][number]) {
  return {
    id: order.id,
    legacyId: order.legacyId,
    verticalId: order.verticalId,
    status: order.status,
    type: order.type,
    orderedAt: iso(order.orderedAt),
    createdAt: order.createdAt.toISOString(),
    facility: order.facility,
    professional: order.professional,
    seller: order.seller,
    itemCount: order.itemCount,
    itemsTotal: order.itemsTotal,
    freight: order.freight,
    total: order.itemsTotal + order.freight,
    items: (order.itemPreviews ?? []).map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.quantity * item.unitPrice,
    })),
  };
}

function serializeOrder(order: OrderDetailRecord) {
  const itemsTotal = order.items.reduce((total, item) => total + item.quantity * item.unitPrice, 0);

  return {
    id: order.id,
    legacyId: order.legacyId,
    verticalId: order.verticalId,
    status: order.status,
    type: order.type,
    orderedAt: iso(order.orderedAt),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    facility: order.facility,
    professional: order.professional,
    seller: order.seller,
    surgeryType: order.surgeryType,
    surgerySubtype: order.surgerySubtype,
    notes: order.notes,
    freight: order.freight,
    grossWeight: order.grossWeight,
    netWeight: order.netWeight,
    currency: order.currency,
    usdExchangeRate: order.usdExchangeRate,
    finalizedById: order.finalizedById,
    finalizedAt: iso(order.finalizedAt),
    rejectedById: order.rejectedById,
    rejectionReason: order.rejectionReason,
    noBillingById: order.noBillingById,
    noBillingAt: iso(order.noBillingAt),
    noBillingNotes: order.noBillingNotes,
    expenseAuthorizedById: order.expenseAuthorizedById,
    expenseAuthorizedAt: iso(order.expenseAuthorizedAt),
    itemCount: order.items.length,
    itemsTotal,
    total: itemsTotal + order.freight,
    items: order.items.map((item) => ({
      ...item,
      lineTotal: item.quantity * item.unitPrice,
      usdPrice: item.usdPrice,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
  };
}

export class ListOrdersUseCase {
  constructor(private readonly deps: { orderRepository: OrderRepository }) {}

  async execute(input: {
    page?: number;
    limit?: number;
    statuses?: OrderStatus[];
    facilityId?: string;
    verticalId?: string;
    /** Authenticated user — used for REP seller filter. */
    actor?: { userId: string; roleName: string };
    includeItemPreviews?: boolean;
    scope: ScopeContext;
  }) {
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;

    if (input.facilityId) {
      assertResourceInScope(input.scope, "facility", input.facilityId);
    }

    const verticalIds = resolveVerticalIds({
      role: input.actor?.roleName ?? "",
      assignedVerticalIds: input.scope.assignedVerticalIds ?? [],
      queryVerticalId: input.verticalId,
    });

    if (verticalIds.length === 0) {
      return {
        data: [],
        pagination: { page, limit, total: 0, totalPages: 1 },
      };
    }

    const sellerId =
      input.actor?.roleName === Role.REP ? input.actor.userId : undefined;

    const { orders, total } = await this.deps.orderRepository.findAll({
      page,
      limit,
      statuses: input.statuses,
      facilityId: input.facilityId,
      verticalIds,
      sellerId,
      includeItemPreviews: input.includeItemPreviews,
      scope: input.scope.isGlobal
        ? { isGlobal: true }
        : { isGlobal: false, facilityIds: input.scope.facilityIds },
    });

    return {
      data: orders.map(serializeListOrder),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }
}

export class GetOrderUseCase {
  constructor(private readonly deps: { orderRepository: OrderRepository }) {}

  async execute(input: {
    orderId: string;
    scope: ScopeContext;
    actor?: { userId: string; roleName: string };
    verticalId?: string;
  }) {
    const order = await this.deps.orderRepository.findById(input.orderId);
    if (!order) return null;

    assertResourceInScope(input.scope, "facility", order.facility.id);

    const verticalIds = resolveVerticalIds({
      role: input.actor?.roleName ?? "",
      assignedVerticalIds: input.scope.assignedVerticalIds ?? [],
      queryVerticalId: input.verticalId,
    });
    if (!verticalIds.includes(order.verticalId)) {
      throw new ForbiddenError("Order vertical outside actor scope");
    }

    if (
      input.actor?.roleName === Role.REP &&
      order.seller?.id !== input.actor.userId
    ) {
      throw new ForbiddenError("Order seller outside actor scope");
    }

    return serializeOrder(order);
  }
}
