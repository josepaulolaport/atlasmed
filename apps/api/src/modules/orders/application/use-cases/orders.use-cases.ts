import {
  assertResourceInScope,
  ForbiddenError,
  Role,
  type ScopeContext,
} from "@atlasmed/access";
import { resolveVerticalIds } from "../../../access/application/services/vertical-access.service";
import { ValidationError } from "../../../../shared/errors";
import type {
  CreateOrderItemInput,
  OrderDetailRecord,
  OrderRepository,
  OrderStatus,
} from "../interfaces/order.repository.interface";
import type { InteractionContextPort } from "../interfaces/interaction-context.port";

const CREATE_ORDER_TYPES = ["SALE", "CONSIGNMENT", "DONATION", "OTHER"] as const;
const CREATE_ORDER_STATUSES = ["DRAFT", "PENDING"] as const;

function resolveCreateOrderVerticalId(input: {
  role: string;
  assignedVerticalIds: string[];
  verticalId?: string;
}): string {
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
    legacyId: order.legacyId,
    interactionId: order.interactionId,
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
    interactionId: order.interactionId,
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
    interactionId?: string;
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
      interactionId: input.interactionId,
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

export class CreateOrderUseCase {
  constructor(
    private readonly deps: {
      orderRepository: OrderRepository;
      interactionContextPort?: InteractionContextPort;
    },
  ) {}

  async execute(input: {
    facilityId: string;
    interactionId?: string;
    verticalId?: string;
    professionalId?: string | null;
    status?: (typeof CREATE_ORDER_STATUSES)[number];
    type?: (typeof CREATE_ORDER_TYPES)[number];
    notes?: string | null;
    freight?: number;
    orderedAt?: string;
    items: CreateOrderItemInput[];
    scope: ScopeContext;
    actor: { userId: string; roleName: string };
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);

    if (input.interactionId) {
      const interaction = await this.deps.interactionContextPort?.findById(input.interactionId);
      if (!interaction || !interaction.canRead) {
        throw new ForbiddenError("Interaction outside actor scope");
      }
      if (interaction.agentUserId !== input.actor.userId) {
        throw new ForbiddenError("Interaction owner outside actor scope");
      }
      if (interaction.facilityId !== input.facilityId) {
        throw new ValidationError([
          { field: "facilityId", message: "Facility must match the interaction" },
        ]);
      }
      if (
        !interaction.canCreateOrder ||
        !["SCHEDULED", "IN_PROGRESS"].includes(interaction.status)
      ) {
        throw new ValidationError([
          { field: "interactionId", message: "Interaction status does not allow order creation" },
        ]);
      }
    }

    const verticalId = resolveCreateOrderVerticalId({
      role: input.actor.roleName,
      assignedVerticalIds: input.scope.assignedVerticalIds ?? [],
      verticalId: input.verticalId,
    });

    if (!input.items?.length) {
      throw new ValidationError([{ field: "items", message: "At least one item is required" }]);
    }

    const issues: Array<{ field: string; message: string }> = [];
    const seenProducts = new Set<string>();
    for (let index = 0; index < input.items.length; index += 1) {
      const item = input.items[index]!;
      const field = `items[${index}]`;
      if (!item.productId?.trim()) {
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
      interactionId: input.interactionId ?? null,
      verticalId,
      sellerId: input.actor.userId,
      professionalId: input.professionalId ?? null,
      status: input.status ?? "PENDING",
      type: input.type ?? "SALE",
      notes: input.notes ?? null,
      freight: input.freight ?? 0,
      orderedAt: input.orderedAt ? new Date(input.orderedAt) : new Date(),
      items,
    });

    return serializeOrder(order);
  }
}
