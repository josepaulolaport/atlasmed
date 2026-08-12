import { DrizzlePotentialRepository } from "./infrastructure/repositories/drizzle/drizzle-potential.repository";
import {
  CreatePotentialDefinitionUseCase,
  LinkProductPotentialUseCase,
  ListDefinitionProductsUseCase,
  ListFacilityPotentialsUseCase,
  ListPotentialDefinitionsUseCase,
  SetFacilityProductUsageUseCase,
  RemoveFacilityProductUsageUseCase,
  SetNoOtherBrandsUseCase,
  SoftDeletePotentialDefinitionUseCase,
  UnlinkProductPotentialUseCase,
  UpdatePotentialDefinitionUseCase,
} from "./application/use-cases/potential.use-cases";
import { RecomputeMetricSnapshotsUseCase } from "./application/use-cases/recompute-metric-snapshots.use-case";

const potentialRepository = new DrizzlePotentialRepository();
const recomputeSnapshots = new RecomputeMetricSnapshotsUseCase();

const deps = { potentialRepository };

/**
 * A rep's edit recomputes inline (spec 0013 §4.4), so the number is correct when
 * the screen redraws. Order writes enqueue instead — see the orders module.
 */
const writeDeps = {
  potentialRepository,
  recomputeSnapshots: (input: { profileId: number }) =>
    recomputeSnapshots.execute(input),
};

export const potentialUseCases = {
  listFacilityPotentials: () => new ListFacilityPotentialsUseCase(deps),
  setFacilityProductUsage: () => new SetFacilityProductUsageUseCase(writeDeps),
  removeFacilityProductUsage: () => new RemoveFacilityProductUsageUseCase(writeDeps),
  setNoOtherBrands: () => new SetNoOtherBrandsUseCase(writeDeps),
  listDefinitions: () => new ListPotentialDefinitionsUseCase(deps),
  createDefinition: () => new CreatePotentialDefinitionUseCase(deps),
  updateDefinition: () => new UpdatePotentialDefinitionUseCase(deps),
  softDeleteDefinition: () => new SoftDeletePotentialDefinitionUseCase(deps),
  linkProduct: () => new LinkProductPotentialUseCase(deps),
  unlinkProduct: () => new UnlinkProductPotentialUseCase(deps),
  listDefinitionProducts: () => new ListDefinitionProductsUseCase(deps),
};
