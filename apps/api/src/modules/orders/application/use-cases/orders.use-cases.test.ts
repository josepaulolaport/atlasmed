import { describe, expect, it, spyOn } from "bun:test";
import { ForbiddenError, type ScopeContext } from "@atlasmed/access";
import { ValidationError } from "../../../../shared/errors";
import { logger } from "../../../../infrastructure/logging/logger";
import {
  CreateOrderUseCase,
  GetOrderUseCase,
  ListOrdersUseCase,
} from "./orders.use-cases";
import type { OrderRepository } from "../interfaces/order.repository.interface";

const scopedToFacilityOne: ScopeContext = {
  isGlobal: false,
  assignedTerritoryIds: [1],
  effectiveTerritoryIds: [1],
  analyticsEffectiveTerritoryIds: [1],
  territoryIds: [1],
  facilityIds: [1],
  analyticsFacilityIds: [1],
  clinicIds: [1],
  analyticsClinicIds: [1],
  managedUserIds: [],
  assignedVerticalIds: [1],
  isOperationallyActive: true,
};

function createRepository(overrides: Partial<OrderRepository> = {}): OrderRepository {
  return {
    findAll: async () => ({
      orders: [
        {
          id: 1,
          idAvulsaEmultec: 42,
          verticalId: 1,
          facility: { id: 1, name: "Clínica Um" },
          person: { id: 1, name: "Dra. Ana" },
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
      statusCounts: {
        DRAFT: 0,
        PENDING: 1,
        APPROVED: 0,
        INVOICED: 0,
        REJECTED: 0,
        NO_BILLING: 0,
      },
    }),
    findById: async (id) =>
      id === 2
        ? {
            id,
            idAvulsaEmultec: null,
            verticalId: 1,
            facilityVerticalProfileId: 55,
            facility: { id: 2, name: "Clínica Dois" },
            person: null,
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
            interactionId: null,
            finalizedBy: null,
            usdExchangeRate: null,
            finalizedById: null,
            finalizedAt: null,
            rejectedBy: null,
            rejectedById: null,
            rejectionReason: null,
            noBillingBy: null,
            noBillingById: null,
            noBillingAt: null,
            noBillingNotes: null,
            expenseAuthorizedBy: null,
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
      facilityId: 1,
      includeItemPreviews: true,
      actor: { userId: 1, roleName: "REP" },
      scope: scopedToFacilityOne,
    });

    expect(received).not.toBeNull();
    expect(received).toMatchObject({
      page: 2,
      limit: 10,
      statuses: ["PENDING", "APPROVED"],
      facilityId: 1,
      verticalIds: [1],
      sellerId: 1,
      includeItemPreviews: true,
      scope: { isGlobal: false, facilityIds: [1] },
    });
    expect(result.pagination).toEqual({ page: 2, limit: 10, total: 1, totalPages: 1 });
    expect(result.data[0]).toMatchObject({
      id: 1,
      idAvulsaEmultec: 42,
      verticalId: 1,
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
        orderId: 2,
        scope: scopedToFacilityOne,
      })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("denies REP detail access when the seller is another user", async () => {
    const repository = createRepository();
    repository.findById = async () => ({
      id: 1,
      idAvulsaEmultec: null,
      verticalId: 1,
      facilityVerticalProfileId: 55,
      facility: { id: 1, name: "Clínica Um" },
      person: null,
      seller: { id: 99, name: "Outro" },
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
      interactionId: null,
      finalizedBy: null,
      usdExchangeRate: null,
      finalizedById: null,
      finalizedAt: null,
      rejectedBy: null,
      rejectedById: null,
      rejectionReason: null,
      noBillingBy: null,
      noBillingById: null,
      noBillingAt: null,
      noBillingNotes: null,
      expenseAuthorizedBy: null,
      expenseAuthorizedById: null,
      expenseAuthorizedAt: null,
      items: [],
    });

    await expect(
      new GetOrderUseCase({ orderRepository: repository }).execute({
        orderId: 1,
        scope: scopedToFacilityOne,
        actor: { userId: 1, roleName: "REP" },
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  function createdOrderRecord(
    input: Parameters<OrderRepository["create"]>[0],
  ): Awaited<ReturnType<OrderRepository["create"]>> {
    return {
          id: 100,
          idAvulsaEmultec: null,
          verticalId: input.verticalId,
          facilityVerticalProfileId: 777,
          facility: { id: input.facilityId, name: "Clínica Um" },
          person: null,
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
          interactionId: null,
          finalizedBy: null,
          usdExchangeRate: null,
          finalizedById: null,
          finalizedAt: null,
          rejectedBy: null,
          rejectedById: null,
          rejectionReason: null,
          noBillingBy: null,
          noBillingById: null,
          noBillingAt: null,
          noBillingNotes: null,
          expenseAuthorizedBy: null,
          expenseAuthorizedById: null,
          expenseAuthorizedAt: null,
          items: input.items.map((item, index) => ({
            id: index + 1,
            idAvulsaItemEmultec: null,
            product: { id: item.productId, name: "Produto", code: "P1" },
            idProdutoEmultec: null,
            quantity: item.quantity,
            unitPrice: item.unitPrice ?? 100,
            usdPrice: null,
            batchNumber: null,
            writtenOff: false,
            createdAt: new Date("2026-01-01T10:00:00Z"),
            updatedAt: new Date("2026-01-01T10:00:00Z"),
          })),
    };
  }

  function createRecordingRepository(): {
    repository: OrderRepository;
    created: () => Parameters<OrderRepository["create"]>[0] | null;
  } {
    let seen: Parameters<OrderRepository["create"]>[0] | null = null;
    const repository = createRepository({
      create: async (input) => {
        seen = input;
        return createdOrderRecord(input);
      },
    });
    return { repository, created: () => seen };
  }

  it("creates an order when facility profile and products match the vertical", async () => {
    const { repository, created: readCreated } = createRecordingRepository();

    const result = await new CreateOrderUseCase({ orderRepository: repository }).execute({
      facilityId: 1,
      items: [{ productId: 1, quantity: 2 }],
      scope: scopedToFacilityOne,
      actor: { userId: 1, roleName: "REP" },
    });

    expect(readCreated()).toMatchObject({
      facilityId: 1,
      verticalId: 1,
      sellerId: 1,
      items: [{ productId: 1, quantity: 2, unitPrice: 100 }],
    });
    expect(result).toMatchObject({
      id: 100,
      verticalId: 1,
      itemCount: 1,
      total: 200,
    });
  });

  it("enqueues a metric snapshot recompute for the order's profile", async () => {
    const enqueued: Array<{ facilityVerticalProfileId: number }> = [];
    const { repository } = createRecordingRepository();

    await new CreateOrderUseCase({
      orderRepository: repository,
      metricSnapshotQueue: {
        enqueue: async (input) => {
          enqueued.push(input);
        },
      },
    }).execute({
      facilityId: 1,
      // Backdated, and deliberately so: a recompute rebuilds the whole profile
      // from a rolling window, so when the order was placed must not reach the
      // request. It used to, and two orders in two months meant two runs.
      orderedAt: "2026-04-01T01:00:00.000Z",
      items: [{ productId: 1, quantity: 2 }],
      scope: scopedToFacilityOne,
      actor: { userId: 1, roleName: "REP" },
    });

    expect(enqueued).toEqual([{ facilityVerticalProfileId: 777 }]);
  });

  it("still returns the order when the recompute cannot be enqueued, and says so", async () => {
    const { repository } = createRecordingRepository();
    const logged = spyOn(logger, "error").mockImplementation(() => {});

    try {
      // The order is committed and correct; the snapshot is derived, and the
      // hourly sweep is what makes it right. Failing the write would be worse.
      const result = await new CreateOrderUseCase({
        orderRepository: repository,
        metricSnapshotQueue: {
          enqueue: async () => {
            throw new Error("temporal unreachable");
          },
        },
      }).execute({
        facilityId: 1,
        items: [{ productId: 1, quantity: 2 }],
        scope: scopedToFacilityOne,
        actor: { userId: 1, roleName: "REP" },
      });

      expect(result).toMatchObject({ id: 100 });
      // Tolerated, never hidden: a trigger that keeps failing must be visible,
      // or the sweep repairs the number and buries the fault with it.
      const reported = logged.mock.calls.filter(
        (call) => call[0] === "facility_metric_snapshot.trigger_enqueue_failed",
      );
      expect(reported).toHaveLength(1);
      expect(reported[0]![1]).toMatchObject({
        facilityVerticalProfileId: 777,
        error: "temporal unreachable",
      });
    } finally {
      logged.mockRestore();
    }
  });

  it("rejects create when facility has no profile for the vertical", async () => {
    const repository = createRepository({
      hasActiveFacilityVerticalProfile: async () => false,
    });

    await expect(
      new CreateOrderUseCase({ orderRepository: repository }).execute({
        facilityId: 1,
        items: [{ productId: 1, quantity: 1 }],
        scope: scopedToFacilityOne,
        actor: { userId: 1, roleName: "REP" },
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
