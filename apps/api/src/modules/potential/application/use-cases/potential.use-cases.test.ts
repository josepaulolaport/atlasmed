import { describe, expect, it, mock } from "bun:test";
import type { ScopeContext } from "@atlasmed/access";
import {
  ForbiddenError,
  ResourceNotFoundError,
} from "../../../../shared/errors";
import type { PotentialRepository } from "../interfaces/potential.repository.interface";
import {
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
    findProfileById: async () => null,
    upsertMetricSnapshots: async () => undefined,
    listMetricSnapshotKeys: async () => [],
    listUsage: async () => [],
    upsertUsage: async () => undefined,
    deleteUsage: async () => true,
    sumAtlasmedQtyByDefinitionAndMonth: async () => [],
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
