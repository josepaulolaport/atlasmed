import { describe, expect, it } from "bun:test";
import { ForbiddenError, type ScopeContext } from "@atlasmed/access";
import { ValidationError } from "../../../../shared/errors";
import {
  CreateOrderUseCase,
  GetOrderUseCase,
  ListOrdersUseCase,
} from "./orders.use-cases";
import type { OrderDetailRecord, OrderRepository } from "../interfaces/order.repository.interface";

function createInteractionContextPort(
  context: {
    id: string;
    agentUserId: string;
    facilityId: string;
    status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "NOT_COMPLETED" | "CANCELLED";
    calendarStatus: "ACTIVE" | "CANCELLED";
    occurrenceStatus: "ACTIVE" | "CANCELLED" | null;
    canRead: boolean;
    canCreateOrder: boolean;
  } | null,
) {
  return {
    findById: async () => context,
  };
}

const scopedToFacilityOne: ScopeContext = {
  isGlobal: false,
  assignedTerritoryIds: ["territory-1"],
  effectiveTerritoryIds: ["territory-1"],
  analyticsEffectiveTerritoryIds: ["territory-1"],
  territoryIds: ["territory-1"],
  facilityIds: ["facility-1"],
  analyticsFacilityIds: ["facility-1"],
  clinicIds: ["facility-1"],
  analyticsClinicIds: ["facility-1"],
  managedUserIds: [],
  assignedVerticalIds: ["vertical-1"],
  isOperationallyActive: true,
};

function createRepository(overrides: Partial<OrderRepository> = {}): OrderRepository {
  return {
    findAll: async () => ({
      orders: [
        {
          id: "order-1",
          legacyId: 42,
          interactionId: null,
          verticalId: "vertical-1",
          facility: { id: "facility-1", name: "Clínica Um" },
          professional: { id: "professional-1", name: "Dra. Ana" },
          seller: null,
          status: "PENDING",
          type: "STANDARD",
          orderedAt: new Date("2026-01-02T10:00:00Z"),
          createdAt: new Date("2026-01-01T10:00:00Z"),
          freight: 10,
          itemCount: 2,
          itemsTotal: 200,
        },
      ],
      total: 1,
    }),
    findById: async (id) =>
      id === "order-2"
        ? {
            id,
            legacyId: null,
            interactionId: null,
            verticalId: "vertical-1",
            facility: { id: "facility-2", name: "Clínica Dois" },
            professional: null,
            seller: null,
            status: "APPROVED",
            type: "STANDARD",
            orderedAt: null,
            createdAt: new Date("2026-01-01T10:00:00Z"),
            updatedAt: new Date("2026-01-01T10:00:00Z"),
            surgeryType: null,
            surgerySubtype: null,
            notes: null,
            freight: 0,
            grossWeight: 0,
            netWeight: 0,
            currency: "BRL",
            usdExchangeRate: null,
            finalizedById: null,
            finalizedAt: null,
            rejectedById: null,
            rejectionReason: null,
            noBillingById: null,
            noBillingAt: null,
            noBillingNotes: null,
            expenseAuthorizedById: null,
            expenseAuthorizedAt: null,
            items: [],
          }
        : null,
    create: async () => {
      throw new Error("unused");
    },
    hasActiveFacilityVerticalProfile: async () => true,
    findProductIdsInVertical: async (productIds) => productIds,
    findProductUnitPrices: async (productIds) =>
      new Map(productIds.map((id) => [id, 100])),
    findCommandReceipt: async () => null,
    createIdempotently: async (_actorUserId, _key, _fingerprint, input) => ({
      kind: "created" as const,
      order: await createRepository(overrides).create(input),
    }),
    ...overrides,
  };
}

describe("orders use cases", () => {
  it("passes pagination, status, and facility scope to the repository", async () => {
    const repository = createRepository();
    const findAll = repository.findAll;
    let received: Parameters<typeof findAll>[0] | null = null;
    repository.findAll = async (input) => {
      received = input;
      return findAll(input);
    };

    const result = await new ListOrdersUseCase({ orderRepository: repository }).execute({
      page: 2,
      limit: 10,
      statuses: ["PENDING", "APPROVED"],
      facilityId: "facility-1",
      interactionId: "interaction-1",
      includeItemPreviews: true,
      actor: { userId: "rep-1", roleName: "REP" },
      scope: scopedToFacilityOne,
    });

    expect(received).not.toBeNull();
    expect(received).toMatchObject({
      page: 2,
      limit: 10,
      statuses: ["PENDING", "APPROVED"],
      facilityId: "facility-1",
      interactionId: "interaction-1",
      verticalIds: ["vertical-1"],
      sellerId: "rep-1",
      includeItemPreviews: true,
      scope: { isGlobal: false, facilityIds: ["facility-1"] },
    });
    expect(result.pagination).toEqual({ page: 2, limit: 10, total: 1, totalPages: 1 });
    expect(result.data[0]).toMatchObject({
      id: "order-1",
      legacyId: 42,
      interactionId: null,
      verticalId: "vertical-1",
      status: "PENDING",
      facility: { name: "Clínica Um" },
      total: 210,
      itemCount: 2,
    });
  });

  it("denies detail access when its facility is outside the scope", async () => {
    const repository = createRepository();

    await expect(
      new GetOrderUseCase({ orderRepository: repository }).execute({
        orderId: "order-2",
        scope: scopedToFacilityOne,
      })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("denies REP detail access when the seller is another user", async () => {
    const repository = createRepository();
    repository.findById = async () => ({
      id: "order-1",
      legacyId: null,
      interactionId: null,
      verticalId: "vertical-1",
      facility: { id: "facility-1", name: "Clínica Um" },
      professional: null,
      seller: { id: "other-rep", name: "Outro" },
      status: "PENDING",
      type: "STANDARD",
      orderedAt: null,
      createdAt: new Date("2026-01-01T10:00:00Z"),
      updatedAt: new Date("2026-01-01T10:00:00Z"),
      surgeryType: null,
      surgerySubtype: null,
      notes: null,
      freight: 0,
      grossWeight: 0,
      netWeight: 0,
      currency: "BRL",
      usdExchangeRate: null,
      finalizedById: null,
      finalizedAt: null,
      rejectedById: null,
      rejectionReason: null,
      noBillingById: null,
      noBillingAt: null,
      noBillingNotes: null,
      expenseAuthorizedById: null,
      expenseAuthorizedAt: null,
      items: [],
    });

    await expect(
      new GetOrderUseCase({ orderRepository: repository }).execute({
        orderId: "order-1",
        scope: scopedToFacilityOne,
        actor: { userId: "rep-1", roleName: "REP" },
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("creates an order when facility profile and products match the vertical", async () => {
    let created: Parameters<OrderRepository["create"]>[0] | null = null;
    const repository = createRepository({
      create: async (input) => {
        created = input;
        return {
          id: "order-new",
          legacyId: null,
          interactionId: input.interactionId ?? null,
          verticalId: input.verticalId,
          facility: { id: input.facilityId, name: "Clínica Um" },
          professional: null,
          seller: { id: input.sellerId!, name: "Rep" },
          status: input.status ?? "PENDING",
          type: input.type ?? "SALE",
          orderedAt: input.orderedAt ?? new Date(),
          createdAt: new Date("2026-01-01T10:00:00Z"),
          updatedAt: new Date("2026-01-01T10:00:00Z"),
          surgeryType: null,
          surgerySubtype: null,
          notes: input.notes ?? null,
          freight: input.freight ?? 0,
          grossWeight: 0,
          netWeight: 0,
          currency: "BRL",
          usdExchangeRate: null,
          finalizedById: null,
          finalizedAt: null,
          rejectedById: null,
          rejectionReason: null,
          noBillingById: null,
          noBillingAt: null,
          noBillingNotes: null,
          expenseAuthorizedById: null,
          expenseAuthorizedAt: null,
          items: input.items.map((item, index) => ({
            id: `item-${index}`,
            legacyId: null,
            lineNumber: index + 1,
            product: { id: item.productId, name: "Produto", code: "P1" },
            legacyProductId: null,
            quantity: item.quantity,
            unitPrice: item.unitPrice ?? 100,
            usdPrice: null,
            batchNumber: null,
            writtenOff: false,
            createdAt: new Date("2026-01-01T10:00:00Z"),
            updatedAt: new Date("2026-01-01T10:00:00Z"),
          })),
        };
      },
    });

    const result = await new CreateOrderUseCase({ orderRepository: repository }).execute({
      facilityId: "facility-1",
      idempotencyKey: "create-order-1",
      items: [{ productId: "product-1", quantity: 2 }],
      scope: scopedToFacilityOne,
      actor: { userId: "rep-1", roleName: "REP" },
    });

    expect(created).toMatchObject({
      facilityId: "facility-1",
      verticalId: "vertical-1",
      sellerId: "rep-1",
      items: [{ productId: "product-1", quantity: 2, unitPrice: 100 }],
    });
    expect(result).toMatchObject({
      id: "order-new",
      verticalId: "vertical-1",
      itemCount: 1,
      total: 200,
    });
  });

  it("creates an order linked to an owned scheduled interaction", async () => {
    let created: Parameters<OrderRepository["create"]>[0] | null = null;
    const repository = createRepository({
      create: async (input) => {
        created = input;
        return {
          id: "order-linked",
          legacyId: null,
          interactionId: input.interactionId ?? null,
          verticalId: input.verticalId,
          facility: { id: input.facilityId, name: "Clínica Um" },
          professional: null,
          seller: { id: input.sellerId!, name: "Rep" },
          status: input.status ?? "PENDING",
          type: input.type ?? "SALE",
          orderedAt: input.orderedAt ?? new Date(),
          createdAt: new Date("2026-01-01T10:00:00Z"),
          updatedAt: new Date("2026-01-01T10:00:00Z"),
          surgeryType: null,
          surgerySubtype: null,
          notes: null,
          freight: 0,
          grossWeight: 0,
          netWeight: 0,
          currency: "BRL",
          usdExchangeRate: null,
          finalizedById: null,
          finalizedAt: null,
          rejectedById: null,
          rejectionReason: null,
          noBillingById: null,
          noBillingAt: null,
          noBillingNotes: null,
          expenseAuthorizedById: null,
          expenseAuthorizedAt: null,
          items: [],
        };
      },
    });

    const result = await new CreateOrderUseCase({
      orderRepository: repository,
      interactionContextPort: createInteractionContextPort({
        id: "interaction-1",
        agentUserId: "rep-1",
        facilityId: "facility-1",
        status: "SCHEDULED",
        calendarStatus: "ACTIVE",
        occurrenceStatus: "ACTIVE",
        canRead: true,
        canCreateOrder: true,
      }),
    }).execute({
      interactionId: "interaction-1",
      facilityId: "facility-1",
      idempotencyKey: "create-linked-order-1",
      items: [{ productId: "product-1", quantity: 1 }],
      scope: scopedToFacilityOne,
      actor: { userId: "rep-1", roleName: "REP" },
    });

    expect(created).toMatchObject({ interactionId: "interaction-1", sellerId: "rep-1" });
    expect(result.interactionId).toBe("interaction-1");
  });

  it("rejects a linked order when interaction ownership does not match", async () => {
    await expect(
      new CreateOrderUseCase({
        orderRepository: createRepository(),
        interactionContextPort: createInteractionContextPort({
          id: "interaction-1",
          agentUserId: "other-rep",
          facilityId: "facility-1",
          status: "SCHEDULED",
          calendarStatus: "ACTIVE",
          occurrenceStatus: "ACTIVE",
          canRead: true,
          canCreateOrder: true,
        }),
      }).execute({
        interactionId: "interaction-1",
        facilityId: "facility-1",
        idempotencyKey: "wrong-owner-order",
        items: [{ productId: "product-1", quantity: 1 }],
        scope: scopedToFacilityOne,
        actor: { userId: "rep-1", roleName: "REP" },
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejects a linked order when facility differs from the interaction", async () => {
    await expect(
      new CreateOrderUseCase({
        orderRepository: createRepository(),
        interactionContextPort: createInteractionContextPort({
          id: "interaction-1",
          agentUserId: "rep-1",
          facilityId: "facility-2",
          status: "IN_PROGRESS",
          calendarStatus: "ACTIVE",
          occurrenceStatus: "ACTIVE",
          canRead: true,
          canCreateOrder: true,
        }),
      }).execute({
        interactionId: "interaction-1",
        facilityId: "facility-1",
        idempotencyKey: "wrong-facility-order",
        items: [{ productId: "product-1", quantity: 1 }],
        scope: scopedToFacilityOne,
        actor: { userId: "rep-1", roleName: "REP" },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a linked order when interaction status does not allow creation", async () => {
    await expect(
      new CreateOrderUseCase({
        orderRepository: createRepository(),
        interactionContextPort: createInteractionContextPort({
          id: "interaction-1",
          agentUserId: "rep-1",
          facilityId: "facility-1",
          status: "COMPLETED",
          calendarStatus: "ACTIVE",
          occurrenceStatus: "ACTIVE",
          canRead: true,
          canCreateOrder: false,
        }),
      }).execute({
        interactionId: "interaction-1",
        facilityId: "facility-1",
        idempotencyKey: "closed-interaction-order",
        items: [{ productId: "product-1", quantity: 1 }],
        scope: scopedToFacilityOne,
        actor: { userId: "rep-1", roleName: "REP" },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("replays an idempotent retry without creating a second order", async () => {
    let createCalls = 0;
    const order = {
      id: "order-replayed",
      legacyId: null,
      interactionId: null,
      verticalId: "vertical-1",
      facility: { id: "facility-1", name: "Clínica Um" },
      professional: null,
      seller: { id: "rep-1", name: "Rep" },
      status: "PENDING" as const,
      type: "SALE",
      orderedAt: new Date("2026-01-02T10:00:00Z"),
      createdAt: new Date("2026-01-02T10:00:00Z"),
      updatedAt: new Date("2026-01-02T10:00:00Z"),
      surgeryType: null,
      surgerySubtype: null,
      notes: null,
      freight: 0,
      grossWeight: 0,
      netWeight: 0,
      currency: "BRL",
      usdExchangeRate: null,
      finalizedById: null,
      finalizedAt: null,
      rejectedById: null,
      rejectionReason: null,
      noBillingById: null,
      noBillingAt: null,
      noBillingNotes: null,
      expenseAuthorizedById: null,
      expenseAuthorizedAt: null,
      items: [],
    };
    let receipt: { fingerprint: string; order: typeof order } | undefined;
    const repository = createRepository({
      findCommandReceipt: async () => receipt
        ? { requestFingerprint: receipt.fingerprint, order: receipt.order }
        : null,
      createIdempotently: async (_actor, _key, fingerprint) => {
        createCalls += 1;
        receipt = { fingerprint, order };
        return { kind: "created" as const, order };
      },
    });
    const useCase = new CreateOrderUseCase({ orderRepository: repository });
    const input = {
      facilityId: "facility-1",
      idempotencyKey: "retry-order",
      items: [{ productId: "product-1", quantity: 1 }],
      scope: scopedToFacilityOne,
      actor: { userId: "rep-1", roleName: "REP" },
    };

    const first = await useCase.execute(input);
    const replay = await useCase.execute(input);

    expect(replay).toEqual(first);
    expect(createCalls).toBe(1);
  });

  it("coalesces concurrent first-time retries through the repository", async () => {
    let createCalls = 0;
    let receipt: { requestFingerprint: string; order: OrderDetailRecord } | null = null;
    let releaseCreation!: () => void;
    const creationStarted = new Promise<void>((resolve) => {
      releaseCreation = resolve;
    });
    const order = {
      id: "order-concurrent",
      legacyId: null,
      interactionId: null,
      verticalId: "vertical-1",
      facility: { id: "facility-1", name: "Clínica Um" },
      professional: null,
      seller: { id: "rep-1", name: "Rep" },
      status: "PENDING" as const,
      type: "SALE",
      orderedAt: new Date("2026-01-02T10:00:00Z"),
      createdAt: new Date("2026-01-02T10:00:00Z"),
      updatedAt: new Date("2026-01-02T10:00:00Z"),
      surgeryType: null,
      surgerySubtype: null,
      notes: null,
      freight: 0,
      grossWeight: 0,
      netWeight: 0,
      currency: "BRL",
      usdExchangeRate: null,
      finalizedById: null,
      finalizedAt: null,
      rejectedById: null,
      rejectionReason: null,
      noBillingById: null,
      noBillingAt: null,
      noBillingNotes: null,
      expenseAuthorizedById: null,
      expenseAuthorizedAt: null,
      items: [],
    } satisfies OrderDetailRecord;
    let serialized = Promise.resolve();
    const repository = createRepository({
      findCommandReceipt: async () => receipt,
      createIdempotently: async (_actor, _key, requestFingerprint) => {
        const previous = serialized;
        let release!: () => void;
        serialized = new Promise<void>((resolve) => {
          release = resolve;
        });
        await previous;
        try {
          if (receipt) {
            return receipt.requestFingerprint === requestFingerprint
              ? { kind: "replay" as const, order: receipt.order }
              : { kind: "mismatch" as const };
          }
          createCalls += 1;
          releaseCreation();
          await Promise.resolve();
          receipt = { requestFingerprint, order };
          return { kind: "created" as const, order };
        } finally {
          release();
        }
      },
    });
    const useCase = new CreateOrderUseCase({ orderRepository: repository });
    const input = {
      facilityId: "facility-1",
      idempotencyKey: "concurrent-order",
      items: [{ productId: "product-1", quantity: 1 }],
      scope: scopedToFacilityOne,
      actor: { userId: "rep-1", roleName: "REP" },
    };

    const first = useCase.execute(input);
    await creationStarted;
    const second = useCase.execute(input);
    const conflicting = useCase.execute({
      ...input,
      items: [{ productId: "product-1", quantity: 2 }],
    });
    const conflictAssertion = expect(conflicting).rejects.toMatchObject({
      statusCode: 409,
      code: "ORDER_IDEMPOTENCY_CONFLICT",
    });
    const [firstResult, secondResult] = await Promise.all([first, second]);
    await conflictAssertion;

    expect(secondResult).toEqual(firstResult);
    expect(createCalls).toBe(1);
  });

  it("rejects reuse of an idempotency key with a different payload", async () => {
    let receipt: { requestFingerprint: string; order: OrderDetailRecord } | null = null;
    const order = {
      id: "order-existing",
      legacyId: null,
      interactionId: null,
      verticalId: "vertical-1",
      facility: { id: "facility-1", name: "Clínica Um" },
      professional: null,
      seller: { id: "rep-1", name: "Rep" },
      status: "PENDING" as const,
      type: "SALE",
      orderedAt: new Date("2026-01-02T10:00:00Z"),
      createdAt: new Date("2026-01-02T10:00:00Z"),
      updatedAt: new Date("2026-01-02T10:00:00Z"),
      surgeryType: null,
      surgerySubtype: null,
      notes: null,
      freight: 0,
      grossWeight: 0,
      netWeight: 0,
      currency: "BRL",
      usdExchangeRate: null,
      finalizedById: null,
      finalizedAt: null,
      rejectedById: null,
      rejectionReason: null,
      noBillingById: null,
      noBillingAt: null,
      noBillingNotes: null,
      expenseAuthorizedById: null,
      expenseAuthorizedAt: null,
      items: [],
    };
    const repository = createRepository({
      findCommandReceipt: async () => receipt,
      createIdempotently: async (_actor, _key, requestFingerprint) => {
        receipt = { requestFingerprint, order };
        return { kind: "created" as const, order };
      },
    });
    const useCase = new CreateOrderUseCase({ orderRepository: repository });
    const base = {
      facilityId: "facility-1",
      idempotencyKey: "reused-order-key",
      scope: scopedToFacilityOne,
      actor: { userId: "rep-1", roleName: "REP" },
    };

    await expect(useCase.execute({ ...base, items: [{ productId: "product-1", quantity: 1 }] })).resolves.toBeDefined();
    await expect(useCase.execute({ ...base, items: [{ productId: "product-1", quantity: 2 }] })).rejects.toMatchObject({
      statusCode: 409,
      code: "ORDER_IDEMPOTENCY_CONFLICT",
    });
  });

  it("rejects a linked order when its calendar series is cancelled despite stale interaction status", async () => {
    await expect(
      new CreateOrderUseCase({
        orderRepository: createRepository(),
        interactionContextPort: createInteractionContextPort({
          id: "interaction-1",
          agentUserId: "rep-1",
          facilityId: "facility-1",
          status: "SCHEDULED",
          calendarStatus: "CANCELLED",
          occurrenceStatus: "ACTIVE",
          canRead: true,
          canCreateOrder: true,
        }),
      }).execute({
        interactionId: "interaction-1",
        facilityId: "facility-1",
        idempotencyKey: "cancelled-series-order",
        items: [{ productId: "product-1", quantity: 1 }],
        scope: scopedToFacilityOne,
        actor: { userId: "rep-1", roleName: "REP" },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a linked order when its occurrence override is cancelled", async () => {
    await expect(
      new CreateOrderUseCase({
        orderRepository: createRepository(),
        interactionContextPort: createInteractionContextPort({
          id: "interaction-1",
          agentUserId: "rep-1",
          facilityId: "facility-1",
          status: "IN_PROGRESS",
          calendarStatus: "ACTIVE",
          occurrenceStatus: "CANCELLED",
          canRead: true,
          canCreateOrder: true,
        }),
      }).execute({
        interactionId: "interaction-1",
        facilityId: "facility-1",
        idempotencyKey: "cancelled-occurrence-order",
        items: [{ productId: "product-1", quantity: 1 }],
        scope: scopedToFacilityOne,
        actor: { userId: "rep-1", roleName: "REP" },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects create when facility has no profile for the vertical", async () => {
    const repository = createRepository({
      hasActiveFacilityVerticalProfile: async () => false,
    });

    await expect(
      new CreateOrderUseCase({ orderRepository: repository }).execute({
        facilityId: "facility-1",
        idempotencyKey: "missing-profile-order",
        items: [{ productId: "product-1", quantity: 1 }],
        scope: scopedToFacilityOne,
        actor: { userId: "rep-1", roleName: "REP" },
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
