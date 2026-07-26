import { describe, expect, it } from "bun:test";
import { ForbiddenError, type ScopeContext } from "@atlasmed/access";
import { ValidationError } from "../../../../shared/errors";
import {
  CreateOrderUseCase,
  GetOrderUseCase,
  ListOrdersUseCase,
} from "./orders.use-cases";
import type { OrderRepository } from "../interfaces/order.repository.interface";

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
      verticalIds: ["vertical-1"],
      sellerId: "rep-1",
      includeItemPreviews: true,
      scope: { isGlobal: false, facilityIds: ["facility-1"] },
    });
    expect(result.pagination).toEqual({ page: 2, limit: 10, total: 1, totalPages: 1 });
    expect(result.data[0]).toMatchObject({
      id: "order-1",
      legacyId: 42,
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

  it("rejects create when facility has no profile for the vertical", async () => {
    const repository = createRepository({
      hasActiveFacilityVerticalProfile: async () => false,
    });

    await expect(
      new CreateOrderUseCase({ orderRepository: repository }).execute({
        facilityId: "facility-1",
        items: [{ productId: "product-1", quantity: 1 }],
        scope: scopedToFacilityOne,
        actor: { userId: "rep-1", roleName: "REP" },
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
