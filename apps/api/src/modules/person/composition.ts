import { DrizzlePersonFacilityProjectionRepository } from "./infrastructure/repositories/drizzle/drizzle-person-facility-projection.repository";
import {
  GetPersonFacilityProjectionUseCase,
  ListPersonFacilityProjectionsUseCase,
  PatchPersonFacilityProjectionUseCase,
  UpsertPersonFacilityProjectionUseCase,
} from "./application/use-cases/person-facility-projection.use-cases";

const repository = new DrizzlePersonFacilityProjectionRepository();

export const personUseCases = {
  listFacilityProjections: () =>
    new ListPersonFacilityProjectionsUseCase({ repository }),
  getFacilityProjection: () => new GetPersonFacilityProjectionUseCase({ repository }),
  upsertFacilityProjection: () =>
    new UpsertPersonFacilityProjectionUseCase({ repository }),
  patchFacilityProjection: () =>
    new PatchPersonFacilityProjectionUseCase({ repository }),
};

export { CLASSIFICATION } from "./application/use-cases/person-facility-projection.use-cases";
