import { PrismaClinicRepository } from "./infrastructure/repositories/prisma/prisma-clinic.repository";
import { PrismaDoctorClinicAssociationRepository } from "./infrastructure/repositories/prisma/prisma-doctor-clinic-association.repository";
import { PrismaTerritoryScopePort } from "./infrastructure/scope/prisma-territory-scope.port";
import {
  CreateClinicUseCase,
  DeleteClinicUseCase,
  GetClinicUseCase,
  ListClinicsUseCase,
  UpdateClinicUseCase,
} from "./application/use-cases/clinic.use-cases";
import {
  ConfirmDoctorAtClinicUseCase,
  EndDoctorClinicAssociationUseCase,
  ListClinicDoctorsUseCase,
  ManuallyAssociateDoctorUseCase,
} from "./application/use-cases/clinic-doctor.use-cases";

export const clinicRepositories = {
  clinic: new PrismaClinicRepository(),
  association: new PrismaDoctorClinicAssociationRepository(),
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
  listClinicDoctors: () =>
    new ListClinicDoctorsUseCase({
      associationRepository: clinicRepositories.association,
    }),
  confirmDoctorAtClinic: () =>
    new ConfirmDoctorAtClinicUseCase({
      associationRepository: clinicRepositories.association,
    }),
  manuallyAssociateDoctor: () =>
    new ManuallyAssociateDoctorUseCase({
      associationRepository: clinicRepositories.association,
    }),
  endDoctorClinicAssociation: () =>
    new EndDoctorClinicAssociationUseCase({
      associationRepository: clinicRepositories.association,
    }),
};
