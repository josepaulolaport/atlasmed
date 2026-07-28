import { DrizzlePotentialRepository } from "./infrastructure/repositories/drizzle/drizzle-potential.repository";
import {
  CreatePotentialDefinitionUseCase,
  LinkProductPotentialUseCase,
  ListDefinitionProductsUseCase,
  ListFacilityPotentialsUseCase,
  ListPotentialDefinitionsUseCase,
  PatchFacilityPotentialsUseCase,
  SoftDeletePotentialDefinitionUseCase,
  UnlinkProductPotentialUseCase,
  UpdatePotentialDefinitionUseCase,
} from "./application/use-cases/potential.use-cases";

const potentialRepository = new DrizzlePotentialRepository();

const deps = { potentialRepository };

export const potentialUseCases = {
  listFacilityPotentials: () => new ListFacilityPotentialsUseCase(deps),
  patchFacilityPotentials: () => new PatchFacilityPotentialsUseCase(deps),
  listDefinitions: () => new ListPotentialDefinitionsUseCase(deps),
  createDefinition: () => new CreatePotentialDefinitionUseCase(deps),
  updateDefinition: () => new UpdatePotentialDefinitionUseCase(deps),
  softDeleteDefinition: () => new SoftDeletePotentialDefinitionUseCase(deps),
  linkProduct: () => new LinkProductPotentialUseCase(deps),
  unlinkProduct: () => new UnlinkProductPotentialUseCase(deps),
  listDefinitionProducts: () => new ListDefinitionProductsUseCase(deps),
};
