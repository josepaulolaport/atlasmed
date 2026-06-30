import { beforeEach, describe, expect, it, mock } from "bun:test";
import { createGlobalScopeContext } from "@atlasmed/access";
import type { FacilityProfessionalRepository } from "../interfaces/facility-professional.repository.interface";
import {
  ConfirmProfessionalAtFacilityUseCase,
  EndFacilityProfessionalUseCase,
  ListFacilityProfessionalsUseCase,
  ManuallyAssociateProfessionalUseCase,
} from "./facility-professional.use-cases";

const facilityId = "facility-1";
const professionalId = "professional-1";
const userId = "user-1";

const professional = {
  id: professionalId,
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
    professionalId,
    facilityId,
    occupationCode: "LEGACY",
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

describe("Facility professional use cases", () => {
  let facilityProfessionalRepository: FacilityProfessionalRepository;

  beforeEach(() => {
    facilityProfessionalRepository = {
      findActiveByFacilityWithProfessionals: mock(async ({ view }) => {
        const row = baseAssociation();
        const associations =
          view === "pending"
            ? [{ ...row, professional }]
            : view === "confirmed"
              ? []
              : [{ ...row, professional }];

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
    } as unknown as FacilityProfessionalRepository;
  });

  it("lists professionals for pending view", async () => {
    const useCase = new ListFacilityProfessionalsUseCase({ facilityProfessionalRepository });

    const result = await useCase.execute({
      facilityId,
      scope: createGlobalScopeContext(),
      view: "pending",
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.association.pendingConfirmation).toBe(true);
    expect(
      facilityProfessionalRepository.findActiveByFacilityWithProfessionals
    ).toHaveBeenCalledWith(expect.objectContaining({ facilityId, view: "pending" }));
  });

  it("confirms a pending professional at facility", async () => {
    const useCase = new ConfirmProfessionalAtFacilityUseCase({ facilityProfessionalRepository });

    const result = await useCase.execute({
      facilityId,
      professionalId,
      userId,
      scope: createGlobalScopeContext(),
    });

    expect(result.confirmedAt).toBeTruthy();
    expect(facilityProfessionalRepository.confirmAssociation).toHaveBeenCalledWith({
      professionalId,
      facilityId,
      confirmedByUserId: userId,
    });
  });

  it("manually associates a professional with confirmed timestamp", async () => {
    const useCase = new ManuallyAssociateProfessionalUseCase({ facilityProfessionalRepository });

    const result = await useCase.execute({
      facilityId,
      professionalId,
      userId,
      scope: createGlobalScopeContext(),
    });

    expect(result.confirmedAt).toBeTruthy();
    expect(facilityProfessionalRepository.manuallyAssociate).toHaveBeenCalledWith({
      professionalId,
      facilityId,
      confirmedByUserId: userId,
    });
  });

  it("ends an active association", async () => {
    const useCase = new EndFacilityProfessionalUseCase({ facilityProfessionalRepository });

    const result = await useCase.execute({
      facilityId,
      professionalId,
      userId,
      scope: createGlobalScopeContext(),
    });

    expect(result?.endedAt).toBeTruthy();
    expect(facilityProfessionalRepository.endAssociation).toHaveBeenCalledWith({
      professionalId,
      facilityId,
      endedByUserId: userId,
      endReason: "manual",
    });
  });
});
