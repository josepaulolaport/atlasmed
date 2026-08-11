import { describe, expect, it, mock } from "bun:test";
import type { ScopeContext } from "@atlasmed/access";
import {
  ForbiddenError,
  ResourceNotFoundError,
} from "../../../../shared/errors";
import type { PotentialRepository } from "../interfaces/potential.repository.interface";
import {
  ListFacilityPotentialsUseCase,
  ListPotentialDefinitionsUseCase,
  UnlinkProductPotentialUseCase,
} from "./potential.use-cases";

const baseScope: ScopeContext = {
  isGlobal: false,
  assignedTerritoryIds: [],
  assignedVerticalIds: [],
  effectiveTerritoryIds: [],
  analyticsEffectiveTerritoryIds: [],
  territoryIds: [],
  facilityIds: [],
  analyticsFacilityIds: [],
  clinicIds: [],
  analyticsClinicIds: [],
  managedUserIds: [],
  isOperationallyActive: true,
};

function createRepository(
  overrides: Partial<PotentialRepository> = {},
): PotentialRepository {
  return {
    listDefinitions: async () => [],
    findDefinitionById: async () => null,
    createDefinition: async () => {
      throw new Error("unused");
    },
    updateDefinition: async () => null,
    softDeleteDefinition: async () => false,
    findProfileId: async () => 1,
    listMetricSnapshots: async () => [],
    listUsage: async () => [],
    listLatestUsageByProduct: async () => [],
    upsertUsage: async () => undefined,
    deleteUsage: async () => true,
    sumAtlasmedQtyByDefinitionAndMonth: async () => [],
    sumAtlasmedQtyByDefinitionAndProduct: async () => [],
    linkProduct: async () => undefined,
    unlinkProduct: async () => false,
    listProductsForDefinition: async () => [],
    productBelongsToVertical: async () => false,
    findLink: async () => null,
    ...overrides,
  };
}

describe("potential scope enforcement", () => {
  it("denies a non-global actor with no assigned verticals", async () => {
    const listDefinitions = mock(async () => []);

    await expect(
      new ListPotentialDefinitionsUseCase({
        potentialRepository: createRepository({ listDefinitions }),
      }).execute({
        verticalId: 1,
        scope: baseScope,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(listDefinitions).not.toHaveBeenCalled();
  });

  it("allows a global actor with no assigned verticals", async () => {
    const listDefinitions = mock(async () => []);

    await new ListPotentialDefinitionsUseCase({
      potentialRepository: createRepository({ listDefinitions }),
    }).execute({
      verticalId: 1,
      scope: { ...baseScope, isGlobal: true },
    });

    expect(listDefinitions).toHaveBeenCalledWith({ verticalId: 1 });
  });

  it("does not unlink when the linked potential definition cannot be resolved", async () => {
    const unlinkProduct = mock(async () => true);

    await expect(
      new UnlinkProductPotentialUseCase({
        potentialRepository: createRepository({
          findLink: async () => ({
            productId: 1,
            definitionId: 2,
            verticalId: 1,
          }),
          findDefinitionById: async () => null,
          unlinkProduct,
        }),
      }).execute({
        productId: 1,
        definitionId: 2,
        scope: { ...baseScope, assignedVerticalIds: [1] },
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);

    expect(unlinkProduct).not.toHaveBeenCalled();
  });
});

describe("what a metric reports for a clinic", () => {
  const globalScope: ScopeContext = { ...baseScope, isGlobal: true };
  const NOW = new Date("2026-08-11T12:00:00.000Z");

  const definition = {
    id: 7,
    key: 'ampolas',
    label: 'Ampolas por mês',
    verticalId: 1,
    deletedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  function usage(productId: number, productName: string, quantity: number) {
    return {
      definitionId: 7,
      productId,
      productName,
      quantity,
      metricQuantity: quantity,
      updatedAt: new Date("2026-06-01T00:00:00.000Z"),
    };
  }

  async function listFor(overrides: Partial<PotentialRepository>) {
    return new ListFacilityPotentialsUseCase({
      potentialRepository: createRepository({
        listDefinitions: async () => [definition],
        ...overrides,
      }),
    }).execute({ facilityId: 1, verticalId: 1, scope: globalScope, now: NOW });
  }

  it("takes a competitor figure at face value instead of dividing it by the window", async () => {
    // The rep answers "quantas por mês", so 100 recorded once means 100 — not
    // 100/3 with two never-surveyed months counted as zeros.
    const page = await listFor({
      listLatestUsageByProduct: async () => [usage(10, 'Marca A', 100)],
    });

    expect(page.items[0]!.competitorMonthlyQty).toBe(100);
  });

  it("adds different competitor products together", async () => {
    const page = await listFor({
      listLatestUsageByProduct: async () => [
        usage(10, 'Marca A', 100),
        usage(11, 'Marca B', 40),
      ],
    });

    expect(page.items[0]!.competitorMonthlyQty).toBe(140);
    expect(page.items[0]!.competitors).toHaveLength(2);
  });

  it("lists exactly the rows that make up the competitor total", async () => {
    // The rows and the tile above them must agree; the read returns one
    // standing row per product, so summing the list reproduces the total.
    const page = await listFor({
      listLatestUsageByProduct: async () => [
        usage(10, 'Marca A', 100),
        usage(11, 'Marca B', 40),
      ],
    });

    const item = page.items[0]!;
    const summed = item.competitors.reduce((s, c) => s + c.metricQuantity, 0);
    expect(summed).toBe(item.competitorMonthlyQty);
  });

  it("breaks our own quantity down by product, and the rows sum to the total", async () => {
    // 90 days of orders normalised to a 30-day month: 300 over the window is
    // 100 a month.
    const page = await listFor({
      sumAtlasmedQtyByDefinitionAndMonth: async () => [
        { definitionId: 7, month: '2026-08-01', totalQty: 900 },
      ],
      sumAtlasmedQtyByDefinitionAndProduct: async () => [
        { definitionId: 7, productId: 1, productName: 'Nosso A', totalQty: 600 },
        { definitionId: 7, productId: 2, productName: 'Nosso B', totalQty: 300 },
      ],
    });

    const item = page.items[0]!;
    expect(item.atlasmedMonthlyAvgQty).toBe(300);
    expect(item.ourProducts.map((p) => p.productName)).toEqual(['Nosso A', 'Nosso B']);
    const summed = item.ourProducts.reduce((s, p) => s + p.metricQuantity, 0);
    expect(summed).toBeCloseTo(item.atlasmedMonthlyAvgQty, 6);
  });

  it("orders our products by size, largest first", async () => {
    const page = await listFor({
      sumAtlasmedQtyByDefinitionAndProduct: async () => [
        { definitionId: 7, productId: 1, productName: 'Menor', totalQty: 30 },
        { definitionId: 7, productId: 2, productName: 'Maior', totalQty: 300 },
      ],
    });

    expect(page.items[0]!.ourProducts.map((p) => p.productName)).toEqual([
      'Maior',
      'Menor',
    ]);
  });

  it("still reports an unknown share when nobody has recorded a competitor", async () => {
    // Unchanged by the averaging fix: no observation is not a zero market.
    const page = await listFor({
      listLatestUsageByProduct: async () => [],
      sumAtlasmedQtyByDefinitionAndMonth: async () => [
        { definitionId: 7, month: '2026-08-01', totalQty: 900 },
      ],
    });

    expect(page.items[0]!.share).toBeNull();
  });
});
