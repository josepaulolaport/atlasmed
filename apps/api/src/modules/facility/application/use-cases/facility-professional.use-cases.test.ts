import { beforeEach, describe, expect, it, mock } from "bun:test";
import { createGlobalScopeContext } from "@atlasmed/access";
import type { FacilityProfessionalRepository } from "../interfaces/facility-professional.repository.interface";
import type { ProfessionalRepository } from "../../../professional/application/interfaces/professional.repository.interface";
import {
  ConfirmProfessionalAtFacilityUseCase,
  EndFacilityProfessionalUseCase,
  GetFacilityProfessionalContextUseCase,
  ListFacilityProfessionalsUseCase,
  ManuallyAssociateProfessionalUseCase,
  UpdateFacilityProfessionalRoleUseCase,
} from "./facility-professional.use-cases";

const facilityId = "facility-1";
const professionalId = "professional-1";
const userId = "user-1";

const professional = {
  id: professionalId,
  firstName: "Jane",
  lastName: "Smith",
  fullName: "Jane Smith",
  socialName: null,
  taxId: "52998224725",
  birthDate: new Date("1990-05-15"),
  mobilePhone: null,
  landlinePhone: null,
  email: null,
  websiteUrl: null,
  imageUrl: null,
  primarySpecialtyLabel: "Cardiology",
  crmCouncil: "CRM",
  crmNumber: "123456",
  crmState: "SP",
  favoriteTeam: null,
  favoriteSport: null,
  hobbies: null,
  notes: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

function baseAssociation(
  overrides: Partial<{
    sourceActive: boolean;
    confirmedAt: Date | null;
    endedAt: Date | null;
    isPartner: boolean;
    relationshipLevel: number | null;
    notes: string | null;
  }> = {}
) {
  return {
    id: "assoc-1",
    professionalId,
    facilityId,
    occupationCode: "LEGACY",
    specialtyLabel: null,
    isPartner: false,
    isPrescriber: false,
    isBuyer: false,
    isDecisionMaker: false,
    relationshipLevel: null as number | null,
    notes: null as string | null,
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
  let professionalRepository: ProfessionalRepository;

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
      findActiveWithProfessional: mock(async () => ({
        association: baseAssociation(),
        professional,
      })),
      updateAssociationRoles: mock(async ({ data }) =>
        baseAssociation({
          isPartner: data.isPartner ?? false,
          relationshipLevel: data.relationshipLevel ?? null,
          notes: data.notes ?? null,
        })
      ),
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

    professionalRepository = {
      findActiveFacilities: mock(async () => [
        { id: facilityId, name: "Facility One" },
      ]),
    } as unknown as ProfessionalRepository;
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

  it("returns composite professional facility context", async () => {
    const useCase = new GetFacilityProfessionalContextUseCase({
      facilityProfessionalRepository,
      professionalRepository,
    });

    const result = await useCase.execute({
      facilityId,
      professionalId,
      scope: createGlobalScopeContext(),
    });

    expect(result?.professional.taxId).toBe("52998224725");
    expect(result?.association.facilityId).toBe(facilityId);
    expect(result?.facilities).toEqual([{ id: facilityId, name: "Facility One" }]);
  });

  it("updates facility-scoped role flags", async () => {
    const useCase = new UpdateFacilityProfessionalRoleUseCase({
      facilityProfessionalRepository,
    });

    const result = await useCase.execute({
      facilityId,
      professionalId,
      scope: createGlobalScopeContext(),
      isPartner: true,
      relationshipLevel: 8,
      notes: "Key contact",
    });

    expect(result?.isPartner).toBe(true);
    expect(result?.relationshipLevel).toBe(8);
    expect(result?.notes).toBe("Key contact");
    expect(facilityProfessionalRepository.updateAssociationRoles).toHaveBeenCalled();
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
