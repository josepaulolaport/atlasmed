import {
  assertResourceInScope,
  ForbiddenError,
  Role,
  type ScopeContext,
} from "@atlasmed/access";
import { resolveVerticalIds } from "../../../access/application/services/vertical-access.service";
import { ValidationError } from "../../../../shared/errors";
import { logger } from "../../../../infrastructure/logging/logger";
import type {
  CreateOrderItemInput,
  OrderDetailRecord,
  OrderRepository,
  OrderStatus,
  OrderStatusCounts,
} from "../interfaces/order.repository.interface";

/** Every status present at zero, so a client never has to read a missing key. */
const EMPTY_STATUS_COUNTS: OrderStatusCounts = {
  DRAFT: 0,
  PENDING: 0,
  APPROVED: 0,
  INVOICED: 0,
  REJECTED: 0,
  NO_BILLING: 0,
};

const CREATE_ORDER_TYPES = ["SALE", "CONSIGNMENT", "DONATION", "OTHER"] as const;
const CREATE_ORDER_STATUSES = ["DRAFT", "PENDING"] as const;

function resolveCreateOrderVerticalId(input: {
  role: string;
  assignedVerticalIds: number[];
  verticalId?: number;
}): number {
  if (input.verticalId) {
    const resolved = resolveVerticalIds({
      role: input.role,
      assignedVerticalIds: input.assignedVerticalIds,
      queryVerticalId: input.verticalId,
    });
    return resolved[0]!;
  }

  if (input.role === Role.ADMIN) {
    throw new ValidationError([
      { field: "verticalId", message: "verticalId is required for ADMIN" },
    ]);
  }

  if (input.assignedVerticalIds.length === 1) {
    return input.assignedVerticalIds[0]!;
  }

  if (input.assignedVerticalIds.length === 0) {
    throw new ForbiddenError("No vertical assignment");
  }

  throw new ValidationError([
    { field: "verticalId", message: "verticalId is required when multiple verticals are assigned" },
  ]);
}

function iso(date: Date | null): string | null {
  return date?.toISOString() ?? null;
}

function serializeListOrder(order: Awaited<ReturnType<OrderRepository["findAll"]>>["orders"][number]) {
  return {
    id: order.id,
    idAvulsaEmultec: order.idAvulsaEmultec,
    verticalId: order.verticalId,
    status: order.status,
    type: order.type,
    orderedAt: iso(order.orderedAt),
    createdAt: order.createdAt.toISOString(),
    facility: order.facility,
    person: order.person,
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
    idAvulsaEmultec: order.idAvulsaEmultec,
    verticalId: order.verticalId,
    status: order.status,
    type: order.type,
    orderedAt: iso(order.orderedAt),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    facility: order.facility,
    person: order.person,
    seller: order.seller,
    interactionId: order.interactionId,
    surgeryType: order.surgeryType,
    surgerySubtype: order.surgerySubtype,
    notes: order.notes,
    freight: order.freight,
    grossWeight: order.grossWeight,
    netWeight: order.netWeight,
    currency: order.currency,
    usdExchangeRate: order.usdExchangeRate,
    finalizedBy: order.finalizedBy,
    finalizedById: order.finalizedById,
    finalizedAt: iso(order.finalizedAt),
    rejectedBy: order.rejectedBy,
    rejectedById: order.rejectedById,
    rejectionReason: order.rejectionReason,
    noBillingBy: order.noBillingBy,
    noBillingById: order.noBillingById,
    noBillingAt: iso(order.noBillingAt),
    noBillingNotes: order.noBillingNotes,
    expenseAuthorizedBy: order.expenseAuthorizedBy,
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
    facilityId?: number;
    verticalId?: number;
    /** Authenticated user — used for REP seller filter. */
    actor?: { userId: number; roleName: string };
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
        statusCounts: { ...EMPTY_STATUS_COUNTS },
      };
    }

    const sellerId =
      input.actor?.roleName === Role.REP ? input.actor.userId : undefined;

    const { orders, total, statusCounts } = await this.deps.orderRepository.findAll({
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
      statusCounts,
    };
  }
}

export class GetOrderUseCase {
  constructor(private readonly deps: { orderRepository: OrderRepository }) {}

  async execute(input: {
    orderId: number;
    scope: ScopeContext;
    actor?: { userId: number; roleName: string };
    verticalId?: number;
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

/**
 * Enqueues the market-metric recompute for a profile (spec 0013 §4.4).
 *
 * A port, not the Temporal client: the order module has no business knowing what
 * carries the request, and a use-case test must be able to make it fail.
 */
export interface MetricSnapshotRecomputeQueue {
  enqueue(input: { facilityVerticalProfileId: number }): Promise<unknown>;
}

export class CreateOrderUseCase {
  constructor(
    private readonly deps: {
      orderRepository: OrderRepository;
      metricSnapshotQueue?: MetricSnapshotRecomputeQueue;
    }
  ) {}

  /**
   * Order writes enqueue rather than recompute inline (spec 0013 §4.4): the
   * Emultec importer writes tens of orders per run and must not carry the
   * metric's cost, and the same profile would otherwise be recomputed once per
   * order.
   *
   * Only the order's own month can have moved — snapshots store month facts, and
   * the trailing average is derived from them at read time.
   *
   * A failure here never fails the order. The write is committed and correct;
   * the snapshot is derived, and the hourly reconciliation sweep is what makes
   * it right. But it is logged: a trigger that keeps failing must be visible,
   * because the sweep would otherwise repair the number and hide the fault.
   */
  private async enqueueMetricSnapshotRecompute(order: OrderDetailRecord): Promise<void> {
    const queue = this.deps.metricSnapshotQueue;
    if (!queue) return;

    try {
      // The whole profile, not the order's month: a recompute rebuilds every
      // metric from a rolling window, so when the order was placed changes
      // nothing about what has to be recomputed.
      await queue.enqueue({
        facilityVerticalProfileId: order.facilityVerticalProfileId,
      });
    } catch (error) {
      logger.error("facility_metric_snapshot.trigger_enqueue_failed", {
        orderId: order.id,
        facilityVerticalProfileId: order.facilityVerticalProfileId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async execute(input: {
    facilityId: number;
    verticalId?: number;
    personId?: number | null;
    status?: (typeof CREATE_ORDER_STATUSES)[number];
    type?: (typeof CREATE_ORDER_TYPES)[number];
    notes?: string | null;
    freight?: number;
    orderedAt?: string;
    items: CreateOrderItemInput[];
    scope: ScopeContext;
    actor: { userId: number; roleName: string };
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);

    const verticalId = resolveCreateOrderVerticalId({
      role: input.actor.roleName,
      assignedVerticalIds: input.scope.assignedVerticalIds ?? [],
      verticalId: input.verticalId,
    });

    if (!input.items?.length) {
      throw new ValidationError([{ field: "items", message: "At least one item is required" }]);
    }

    const issues: Array<{ field: string; message: string }> = [];
    const seenProducts = new Set<number>();
    for (let index = 0; index < input.items.length; index += 1) {
      const item = input.items[index]!;
      const field = `items[${index}]`;
      if (!(typeof item.productId === "number") || !(item.productId > 0)) {
        issues.push({ field: `${field}.productId`, message: "Required" });
        continue;
      }
      if (seenProducts.has(item.productId)) {
        issues.push({ field: `${field}.productId`, message: "Duplicate product" });
      }
      seenProducts.add(item.productId);
      if (!(typeof item.quantity === "number") || !(item.quantity > 0)) {
        issues.push({ field: `${field}.quantity`, message: "Must be greater than 0" });
      }
      if (item.unitPrice !== undefined && (!(typeof item.unitPrice === "number") || item.unitPrice < 0)) {
        issues.push({ field: `${field}.unitPrice`, message: "Must be >= 0" });
      }
    }
    if (input.freight !== undefined && (!(typeof input.freight === "number") || input.freight < 0)) {
      issues.push({ field: "freight", message: "Must be >= 0" });
    }
    if (issues.length > 0) throw new ValidationError(issues);

    const hasProfile = await this.deps.orderRepository.hasActiveFacilityVerticalProfile(
      input.facilityId,
      verticalId
    );
    if (!hasProfile) {
      throw new ValidationError([
        {
          field: "facilityId",
          message: "Facility has no active profile for this vertical",
        },
      ]);
    }

    const productIds = input.items.map((item) => item.productId);
    const linkedIds = new Set(
      await this.deps.orderRepository.findProductIdsInVertical(productIds, verticalId)
    );
    const missing = productIds.filter((id) => !linkedIds.has(id));
    if (missing.length > 0) {
      throw new ValidationError([
        {
          field: "items",
          message: `Products not in vertical: ${missing.join(", ")}`,
        },
      ]);
    }

    const catalogPrices = await this.deps.orderRepository.findProductUnitPrices(productIds);
    const items = input.items.map((item) => {
      const unitPrice = item.unitPrice ?? catalogPrices.get(item.productId);
      if (unitPrice === undefined) {
        throw new ValidationError([
          { field: "items", message: `Missing unit price for product ${item.productId}` },
        ]);
      }
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice,
      };
    });

    const order = await this.deps.orderRepository.create({
      facilityId: input.facilityId,
      verticalId,
      sellerId: input.actor.userId,
      personId: input.personId ?? null,
      status: input.status ?? "PENDING",
      type: input.type ?? "SALE",
      notes: input.notes ?? null,
      freight: input.freight ?? 0,
      orderedAt: input.orderedAt ? new Date(input.orderedAt) : new Date(),
      items,
    });

    await this.enqueueMetricSnapshotRecompute(order);

    return serializeOrder(order);
  }
}
