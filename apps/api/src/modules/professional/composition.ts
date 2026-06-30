import { PrismaProfessionalRepository } from "./infrastructure/repositories/prisma/prisma-professional.repository";
import {
  CreateDoctorUseCase,
  DeleteDoctorUseCase,
  GetProfessionalUseCase,
  ListProfessionalsUseCase,
  UpdateDoctorUseCase,
} from "./application/use-cases/professional.use-cases";

export const professionalRepositories = {
  professional: new PrismaProfessionalRepository(),
};

export const professionalUseCases = {
  listProfessionals: () =>
    new ListProfessionalsUseCase({ doctorRepository: professionalRepositories.professional }),
  getProfessional: () =>
    new GetProfessionalUseCase({ doctorRepository: professionalRepositories.professional }),
  createDoctor: () =>
    new CreateDoctorUseCase({ doctorRepository: professionalRepositories.professional }),
  updateDoctor: () =>
    new UpdateDoctorUseCase({ doctorRepository: professionalRepositories.professional }),
  deleteDoctor: () =>
    new DeleteDoctorUseCase({ doctorRepository: professionalRepositories.professional }),
};

/** @deprecated Use professionalUseCases */
export const doctorUseCases = professionalUseCases;
