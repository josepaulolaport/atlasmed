import { beforeEach, describe, expect, it, mock } from "bun:test";
import { createGlobalScopeContext } from "@atlasmed/access";
import type { DoctorClinicAssociationRepository } from "../interfaces/doctor-clinic-association.repository.interface";
import {
  ConfirmDoctorAtClinicUseCase,
  EndDoctorClinicAssociationUseCase,
  ListClinicDoctorsUseCase,
  ManuallyAssociateDoctorUseCase,
} from "./clinic-doctor.use-cases";

const clinicId = "clinic-1";
const doctorId = "doctor-1";
const userId = "user-1";

const doctor = {
  id: doctorId,
  firstName: "Jane",
  lastName: "Smith",
  specialty: "Cardiology",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

function baseAssociation(overrides: Partial<{
  sourceActive: boolean;
  confirmedAt: Date | null;
  endedAt: Date | null;
}> = {}) {
  return {
    id: "assoc-1",
    doctorId,
    clinicId,
    sourceActive: true,
    sourceFirstSeenAt: new Date("2024-01-01"),
    sourceLastSeenAt: new Date("2024-01-02"),
    confirmedAt: null as Date | null,
    confirmedByUserId: null,
    endedAt: null as Date | null,
    endedByUserId: null,
    endReason: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-02"),
    ...overrides,
  };
}

describe("Clinic doctor use cases", () => {
  let associationRepository: DoctorClinicAssociationRepository;

  beforeEach(() => {
    associationRepository = {
      findActiveByClinicWithDoctors: mock(async ({ view }) => {
        const row = baseAssociation();
        const associations =
          view === "pending"
            ? [{ ...row, doctor }]
            : view === "confirmed"
              ? []
              : [{ ...row, doctor }];

        return { associations, total: associations.length };
      }),
      confirmAssociation: mock(async ({ confirmedByUserId }) => ({
        ...baseAssociation({
          confirmedAt: new Date("2024-02-01"),
        }),
        confirmedByUserId,
      })),
      manuallyAssociate: mock(async ({ confirmedByUserId }) => ({
        ...baseAssociation({
          sourceActive: false,
          confirmedAt: new Date("2024-02-01"),
        }),
        confirmedByUserId,
      })),
      endAssociation: mock(async ({ endedByUserId }) => ({
        ...baseAssociation({
          endedAt: new Date("2024-03-01"),
        }),
        endedByUserId,
        endReason: "manual",
      })),
    } as unknown as DoctorClinicAssociationRepository;
  });

  it("lists doctors for pending view", async () => {
    const useCase = new ListClinicDoctorsUseCase({ associationRepository });

    const result = await useCase.execute({
      clinicId,
      scope: createGlobalScopeContext(),
      view: "pending",
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.association.pendingConfirmation).toBe(true);
    expect(associationRepository.findActiveByClinicWithDoctors).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId, view: "pending" })
    );
  });

  it("confirms a pending doctor at clinic", async () => {
    const useCase = new ConfirmDoctorAtClinicUseCase({ associationRepository });

    const result = await useCase.execute({
      clinicId,
      doctorId,
      userId,
      scope: createGlobalScopeContext(),
    });

    expect(result.confirmedAt).toBeTruthy();
    expect(associationRepository.confirmAssociation).toHaveBeenCalledWith({
      doctorId,
      clinicId,
      confirmedByUserId: userId,
    });
  });

  it("manually associates a doctor with confirmed timestamp", async () => {
    const useCase = new ManuallyAssociateDoctorUseCase({ associationRepository });

    const result = await useCase.execute({
      clinicId,
      doctorId,
      userId,
      scope: createGlobalScopeContext(),
    });

    expect(result.confirmedAt).toBeTruthy();
    expect(associationRepository.manuallyAssociate).toHaveBeenCalledWith({
      doctorId,
      clinicId,
      confirmedByUserId: userId,
    });
  });

  it("ends an active association", async () => {
    const useCase = new EndDoctorClinicAssociationUseCase({ associationRepository });

    const result = await useCase.execute({
      clinicId,
      doctorId,
      userId,
      scope: createGlobalScopeContext(),
    });

    expect(result?.endedAt).toBeTruthy();
    expect(associationRepository.endAssociation).toHaveBeenCalledWith({
      doctorId,
      clinicId,
      endedByUserId: userId,
      endReason: "manual",
    });
  });
});
