import { describe, expect, it, mock } from "bun:test";
import type { ScopeContext } from "@atlasmed/access";
import {
  ForbiddenError,
  ResourceNotFoundError,
  ValidationError,
} from "../../../../shared/errors";
import type { PotentialRepository } from "../interfaces/potential.repository.interface";
import {
  ListFacilityPotentialsUseCase,
  ListPotentialDefinitionsUseCase,
  RemoveFacilityProductUsageUseCase,
  SetFacilityProductUsageUseCase,
  SetNoOtherBrandsUseCase,
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
    listUsage: async () => [],
    listNoOtherBrands: async () => [],
    setNoOtherBrands: async () => undefined,
    upsertUsage: async () => undefined,
    deleteUsageForProduct: async () => true,
    sumAtlasmedQtyByDefinition: async () => [],
    sumAtlasmedQtyByDefinitionAndProduct: async () => [],
    linkProduct: async () => undefined,
    unlinkProduct: async () => false,
    listProductsForDefinition: async () => [],
    // Eligible by default: the picker offers exactly this set, so the refusal
    // is the exception and the test that wants it says so.
    listCompetitorProductsForDefinition: async () => [
      { productId: 10, productName: "Marca A", productCode: "MA-1" },
    ],
    productBelongsToVertical: async () => false,
    // Linked by default: a metric's products are what the rep picks from, so
    // the unlinked case is the exception and each test that wants it says so.
    findLink: async (input) => ({
      productId: input.productId,
      definitionId: input.definitionId,
      verticalId: 1,
    }),
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
      listUsage: async () => [usage(10, 'Marca A', 100)],
    });

    expect(page.items[0]!.competitorMonthlyQty).toBe(100);
  });

  it("adds different competitor products together", async () => {
    const page = await listFor({
      listUsage: async () => [
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
      listUsage: async () => [
        usage(10, 'Marca A', 100),
        usage(11, 'Marca B', 40),
      ],
    });

    const item = page.items[0]!;
    const summed = item.competitors.reduce((s, c) => s + c.quantity, 0);
    expect(summed).toBe(item.competitorMonthlyQty);
  });

  it("breaks our own quantity down by product, and the rows sum to the total", async () => {
    // 90 days of orders normalised to a 30-day month: 300 over the window is
    // 100 a month.
    const page = await listFor({
      sumAtlasmedQtyByDefinition: async () => [
        { definitionId: 7, totalQty: 900 },
      ],
      sumAtlasmedQtyByDefinitionAndProduct: async () => [
        { definitionId: 7, productId: 1, productName: 'Nosso A', totalQty: 600 },
        { definitionId: 7, productId: 2, productName: 'Nosso B', totalQty: 300 },
      ],
    });

    const item = page.items[0]!;
    expect(item.atlasmedMonthlyAvgQty).toBe(300);
    expect(item.ourProducts.map((p) => p.productName)).toEqual(['Nosso A', 'Nosso B']);
    const summed = item.ourProducts.reduce((s, p) => s + p.quantity, 0);
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
      listUsage: async () => [],
      sumAtlasmedQtyByDefinition: async () => [
        { definitionId: 7, totalQty: 900 },
      ],
    });

    expect(page.items[0]!.share).toBeNull();
  });
});

describe("removing a competitor product", () => {
  const globalScope: ScopeContext = { ...baseScope, isGlobal: true };

  it("clears every month it was recorded in, not just the newest", async () => {
    // The regression this guards: removal used to delete the current month
    // only, so the month before it became the standing figure and the product
    // came back with an older number on the next load.
    let deletedFor: unknown = null;
    const repository = createRepository({
      listDefinitions: async () => [],
      deleteUsageForProduct: async (input) => {
        deletedFor = input;
        return true;
      },
    });

    await new RemoveFacilityProductUsageUseCase({
      potentialRepository: repository,
    }).execute({
      facilityId: 1,
      verticalId: 1,
      definitionId: 7,
      productId: 10,
      scope: globalScope,
    });

    expect(deletedFor).toEqual({ profileId: 1, definitionId: 7, productId: 10 });
  });

  it("recomputes the stored value for the profile", async () => {
    // The removal changes the denominator, so the stored value is stale the
    // instant the row goes. One row per profile-metric now, so one recompute —
    // there are no months to enumerate.
    const recomputed: Array<{ profileId: number }> = [];
    await new RemoveFacilityProductUsageUseCase({
      potentialRepository: createRepository({
        listDefinitions: async () => [],
        deleteUsageForProduct: async () => true,
      }),
      recomputeSnapshots: async (input) => {
        recomputed.push(input);
        return undefined;
      },
    }).execute({
      facilityId: 1,
      verticalId: 1,
      definitionId: 7,
      productId: 10,
      scope: globalScope,
    });

    expect(recomputed).toEqual([{ profileId: 1 }]);
  });

  it("reports not-found when the product was never recorded", async () => {
    await expect(
      new RemoveFacilityProductUsageUseCase({
        potentialRepository: createRepository({
          deleteUsageForProduct: async () => false,
        }),
      }).execute({
        facilityId: 1,
        verticalId: 1,
        definitionId: 7,
        productId: 10,
        scope: globalScope,
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });
});

describe("zero is not a quantity, and the claim that replaces it", () => {
  const globalScope: ScopeContext = { ...baseScope, isGlobal: true };
  const definition = {
    id: 7,
    key: 'ampolas',
    label: 'Ampolas por mês',
    verticalId: 1,
    deletedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };

  function repo(overrides: Partial<PotentialRepository> = {}) {
    return createRepository({
      listDefinitions: async () => [definition],
      findDefinitionById: async () => definition,
      ...overrides,
    });
  }

  it("refuses a competitor quantity of zero", async () => {
    // "They sell none here" is a claim about the market, not a measurement of a
    // product. Recorded as a zero it would be anonymous and would keep the
    // product listed among what the clinic uses.
    const upserted: unknown[] = [];
    await expect(
      new SetFacilityProductUsageUseCase({
        potentialRepository: repo({
          upsertUsage: async (input) => {
            upserted.push(input);
          },
        }),
      }).execute({
        facilityId: 1,
        verticalId: 1,
        definitionId: 7,
        productId: 10,
        quantity: 0,
        userId: 3,
        scope: globalScope,
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(upserted).toEqual([]);
  });

  it("clears the claim when a competitor product is recorded", async () => {
    // The two states contradict each other and a database check refuses the
    // pair, so the rep must never be asked to withdraw the claim first.
    const claims: Array<{ value: boolean }> = [];
    await new SetFacilityProductUsageUseCase({
      potentialRepository: repo({
        setNoOtherBrands: async (input) => {
          claims.push({ value: input.value });
        },
      }),
    }).execute({
      facilityId: 1,
      verticalId: 1,
      definitionId: 7,
      productId: 10,
      quantity: 12,
      userId: 3,
      scope: globalScope,
    });

    expect(claims).toEqual([{ value: false }]);
  });

  it("refuses a product that does not count toward the metric", async () => {
    // The read derives eligibility the same way, so a product outside that set
    // is written and then filtered out of the answer: the rep adds a brand, the
    // screen redraws unchanged, and their figure sits where nobody will see it.
    // The write fails instead.
    const upserted: unknown[] = [];
    await expect(
      new SetFacilityProductUsageUseCase({
        potentialRepository: repo({
          listCompetitorProductsForDefinition: async () => [],
          upsertUsage: async (input) => {
            upserted.push(input);
          },
        }),
      }).execute({
        facilityId: 1,
        verticalId: 1,
        definitionId: 7,
        productId: 10,
        quantity: 12,
        userId: 3,
        scope: globalScope,
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(upserted).toEqual([]);
  });

  it("refuses the claim while competitor products are recorded", async () => {
    // Resolving the contradiction by deleting the rep's own figures would be the
    // screen throwing away work to satisfy a checkbox.
    await expect(
      new SetNoOtherBrandsUseCase({
        potentialRepository: repo({
          listUsage: async () => [
            {
              definitionId: 7,
              productId: 10,
              productName: 'Marca A',
              quantity: 12,
              updatedAt: new Date("2026-08-01T00:00:00.000Z"),
            },
          ],
        }),
      }).execute({
        facilityId: 1,
        verticalId: 1,
        definitionId: 7,
        value: true,
        userId: 3,
        scope: globalScope,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("withdrawing the claim is always allowed", async () => {
    // Turning it off asserts nothing, so an empty list is not a precondition.
    const claims: Array<{ value: boolean }> = [];
    await new SetNoOtherBrandsUseCase({
      potentialRepository: repo({
        listUsage: async () => [],
        setNoOtherBrands: async (input) => {
          claims.push({ value: input.value });
        },
      }),
    }).execute({
      facilityId: 1,
      verticalId: 1,
      definitionId: 7,
      value: false,
      userId: 3,
      scope: globalScope,
    });

    expect(claims).toEqual([{ value: false }]);
  });

  it("reports no share for an empty market nobody has vouched for", async () => {
    const page = await new ListFacilityPotentialsUseCase({
      potentialRepository: repo({
        listUsage: async () => [],
        listNoOtherBrands: async () => [],
        sumAtlasmedQtyByDefinition: async () => [{ definitionId: 7, totalQty: 900 }],
      }),
    }).execute({ facilityId: 1, verticalId: 1, scope: globalScope });

    expect(page.items[0]!.share).toBeNull();
    expect(page.items[0]!.noOtherBrands).toBe(false);
  });

  it("reports 100% once a rep has said there is nothing else", async () => {
    const page = await new ListFacilityPotentialsUseCase({
      potentialRepository: repo({
        listUsage: async () => [],
        listNoOtherBrands: async () => [
          { definitionId: 7, noOtherBrands: true, setAt: new Date("2026-08-01T00:00:00.000Z") },
        ],
        sumAtlasmedQtyByDefinition: async () => [{ definitionId: 7, totalQty: 900 }],
      }),
    }).execute({ facilityId: 1, verticalId: 1, scope: globalScope });

    expect(page.items[0]!.share).toBe(1);
    expect(page.items[0]!.noOtherBrands).toBe(true);
    expect(page.items[0]!.noOtherBrandsSetAt).toBe("2026-08-01T00:00:00.000Z");
  });
});
