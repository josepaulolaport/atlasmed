import { PrismaDoctorRepository } from "./infrastructure/repositories/prisma/prisma-doctor.repository";
import {
  CreateDoctorUseCase,
  DeleteDoctorUseCase,
  GetDoctorUseCase,
  ListDoctorsUseCase,
  UpdateDoctorUseCase,
} from "./application/use-cases/doctor.use-cases";

export const doctorRepositories = {
  doctor: new PrismaDoctorRepository(),
};

export const doctorUseCases = {
  listDoctors: () =>
    new ListDoctorsUseCase({ doctorRepository: doctorRepositories.doctor }),
  getDoctor: () =>
    new GetDoctorUseCase({ doctorRepository: doctorRepositories.doctor }),
  createDoctor: () =>
    new CreateDoctorUseCase({ doctorRepository: doctorRepositories.doctor }),
  updateDoctor: () =>
    new UpdateDoctorUseCase({ doctorRepository: doctorRepositories.doctor }),
  deleteDoctor: () =>
    new DeleteDoctorUseCase({ doctorRepository: doctorRepositories.doctor }),
};
