import {
  CreateDoctorUseCase,
  CreateProfessionalNoteUseCase,
  DeleteDoctorUseCase,
  GetProfessionalUseCase,
  ListProfessionalNotesUseCase,
  ListProfessionalsUseCase,
  UpdateDoctorUseCase
} from './application/use-cases/professional.use-cases'
import { DrizzleProfessionalRepository } from './infrastructure/repositories/drizzle/drizzle-professional.repository'

export const professionalRepositories = {
  professional: new DrizzleProfessionalRepository()
}

export const professionalUseCases = {
  listProfessionals: () =>
    new ListProfessionalsUseCase({ doctorRepository: professionalRepositories.professional }),
  getProfessional: () =>
    new GetProfessionalUseCase({ doctorRepository: professionalRepositories.professional }),
  listProfessionalNotes: () =>
    new ListProfessionalNotesUseCase({ doctorRepository: professionalRepositories.professional }),
  createProfessionalNote: () =>
    new CreateProfessionalNoteUseCase({ doctorRepository: professionalRepositories.professional }),
  createDoctor: () =>
    new CreateDoctorUseCase({ doctorRepository: professionalRepositories.professional }),
  updateDoctor: () =>
    new UpdateDoctorUseCase({ doctorRepository: professionalRepositories.professional }),
  deleteDoctor: () =>
    new DeleteDoctorUseCase({ doctorRepository: professionalRepositories.professional })
}

/** @deprecated Use professionalUseCases */
export const doctorUseCases = professionalUseCases
