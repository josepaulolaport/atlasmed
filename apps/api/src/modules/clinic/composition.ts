import { PrismaClinicRepository } from "./infrastructure/repositories/prisma/prisma-clinic.repository";
import { PrismaTerritoryScopePort } from "./infrastructure/scope/prisma-territory-scope.port";
import {
  CreateClinicUseCase,
  DeleteClinicUseCase,
  GetClinicUseCase,
  ListClinicsUseCase,
  UpdateClinicUseCase,
} from "./application/use-cases/clinic.use-cases";

export const clinicRepositories = {
  clinic: new PrismaClinicRepository(),
};

export const clinicTerritoryScopePort = new PrismaTerritoryScopePort(
  clinicRepositories.clinic
);

export const clinicUseCases = {
  listClinics: () =>
    new ListClinicsUseCase({ clinicRepository: clinicRepositories.clinic }),
  getClinic: () =>
    new GetClinicUseCase({ clinicRepository: clinicRepositories.clinic }),
  createClinic: () =>
    new CreateClinicUseCase({ clinicRepository: clinicRepositories.clinic }),
  updateClinic: () =>
    new UpdateClinicUseCase({ clinicRepository: clinicRepositories.clinic }),
  deleteClinic: () =>
    new DeleteClinicUseCase({ clinicRepository: clinicRepositories.clinic }),
};
