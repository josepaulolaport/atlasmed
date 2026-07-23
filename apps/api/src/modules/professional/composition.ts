import { DrizzleProfessionalRepository } from "./infrastructure/repositories/drizzle/drizzle-professional.repository";
import { DrizzleUserProfessionalRelationshipRepository } from "./infrastructure/repositories/drizzle/drizzle-user-professional-relationship.repository";
import { searchService } from "../../infrastructure/search/search.service";
import {
  CreateDoctorUseCase,
  CreateProfessionalNoteUseCase,
  DeleteDoctorUseCase,
  GetProfessionalUseCase,
  ListProfessionalNotesUseCase,
  ListProfessionalsUseCase,
  UpdateDoctorUseCase,
} from "./application/use-cases/professional.use-cases";

export const professionalRepositories = {
  professional: new DrizzleProfessionalRepository(),
  userProfessionalRelationship:
    new DrizzleUserProfessionalRelationshipRepository(),
};

export const professionalUseCases = {
  listProfessionals: () =>
    new ListProfessionalsUseCase({
      doctorRepository: professionalRepositories.professional,
      searchService,
    }),
  getProfessional: () =>
    new GetProfessionalUseCase({ doctorRepository: professionalRepositories.professional }),
  listProfessionalNotes: () =>
    new ListProfessionalNotesUseCase({ doctorRepository: professionalRepositories.professional }),
  createProfessionalNote: () =>
    new CreateProfessionalNoteUseCase({ doctorRepository: professionalRepositories.professional }),
  createDoctor: () =>
    new CreateDoctorUseCase({
      doctorRepository: professionalRepositories.professional,
      userProfessionalRelationshipRepository:
        professionalRepositories.userProfessionalRelationship,
    }),
  updateDoctor: () =>
    new UpdateDoctorUseCase({ doctorRepository: professionalRepositories.professional }),
  deleteDoctor: () =>
    new DeleteDoctorUseCase({ doctorRepository: professionalRepositories.professional }),
};

/** @deprecated Use professionalUseCases */
export const doctorUseCases = professionalUseCases;
