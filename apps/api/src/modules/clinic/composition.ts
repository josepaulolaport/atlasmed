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
import {
  territoryMembershipService,
} from "../territory/composition";
import { geocodingPort } from "../maps/composition";
import { ClinicGeocodingService } from "./application/services/clinic-geocoding.service";

export const clinicRepositories = {
  clinic: new PrismaClinicRepository(),
  association: new PrismaDoctorClinicAssociationRepository(),
};

export const clinicTerritoryScopePort = new PrismaTerritoryScopePort(
  clinicRepositories.clinic
);

export const clinicGeocodingService = new ClinicGeocodingService({
  clinicRepository: clinicRepositories.clinic,
  geocodingPort,
});

async function handleClinicLocationChanged(clinicId: string): Promise<void> {
  await clinicGeocodingService.ensureCoordinatesPersisted(clinicId);
  await territoryMembershipService.assignClinicById(clinicId);
}

const clinicMembershipDeps = {
  clinicRepository: clinicRepositories.clinic,
  clinicGeocodingService,
  onClinicLocationChanged: handleClinicLocationChanged,
};

export const clinicUseCases = {
  listClinics: () => new ListClinicsUseCase(clinicMembershipDeps),
  getClinic: () => new GetClinicUseCase(clinicMembershipDeps),
  createClinic: () => new CreateClinicUseCase(clinicMembershipDeps),
  updateClinic: () => new UpdateClinicUseCase(clinicMembershipDeps),
  deleteClinic: () => new DeleteClinicUseCase(clinicMembershipDeps),
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

export { territoryMembershipService };
