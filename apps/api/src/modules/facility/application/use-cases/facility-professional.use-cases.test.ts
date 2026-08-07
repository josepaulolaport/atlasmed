import { beforeEach, describe, expect, it, mock } from "bun:test";
import { createGlobalScopeContext } from "@atlasmed/access";
import type { FacilityProfessionalRepository } from "../interfaces/facility-professional.repository.interface";
import type { ProfessionalRepository } from "../../../professional/application/interfaces/professional.repository.interface";
import type { UserProfessionalRelationshipRepository } from "../../../professional/application/interfaces/user-professional-relationship.repository.interface";
import {
  ConfirmProfessionalAtFacilityUseCase,
  EndFacilityProfessionalUseCase,
  GetFacilityProfessionalContextUseCase,
  ListFacilityProfessionalsUseCase,
  ManuallyAssociateProfessionalUseCase,
  UpdateFacilityProfessionalRoleUseCase,
} from "./facility-professional.use-cases";

const facilityId = 1;
const professionalId = 1;
const userId = 1;

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
  languages: null,
  hobbies: null,
  notes: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

function baseAssociation(
  overrides: Partial<{
    confirmedAt: Date | null;
    endedAt: Date | null;
    isPartner: boolean;
    notes: string | null;
  }> = {}
) {
  return {
    id: 1,
    professionalId,
    facilityId,
    occupationCode: "LEGACY",
    specialtyLabel: null,
    isPartner: false,
    isPrescriber: false,
    isBuyer: false,
    isDecisionMaker: false,
    notes: null as string | null,
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
  let userProfessionalRelationshipRepository: UserProfessionalRelationshipRepository;
  let levelsByProfessional: Map<number, number>;

  beforeEach(() => {
    levelsByProfessional = new Map();
    facilityProfessionalRepository = {
      findActiveByFacilityWithProfessionals: mock(async ({ view }) => {
        const row = baseAssociation();
        const listProfessional = {
          id: professional.id,
          firstName: professional.firstName,
          lastName: professional.lastName,
          fullName: professional.fullName,
          specialty: professional.primarySpecialtyLabel,
          crmNumber: professional.crmNumber,
          crmState: professional.crmState,
          mobilePhone: professional.mobilePhone,
          landlinePhone: professional.landlinePhone,
          email: professional.email,
          birthDate: professional.birthDate,
          favoriteTeam: professional.favoriteTeam,
          hobbies: professional.hobbies,
          createdAt: professional.createdAt,
          updatedAt: professional.updatedAt,
        };
        const associations =
          view === "confirmed"
            ? []
            : [{ ...row, professional: listProfessional }];

        return { associations, total: associations.length };
      }),
      findActiveWithProfessional: mock(async () => ({
        association: baseAssociation(),
        professional,
      })),
      updateAssociationRoles: mock(async ({ data }) =>
        baseAssociation({
          isPartner: data.isPartner ?? false,
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

    userProfessionalRelationshipRepository = {
      findByUserAndProfessional: mock(async (_userId, professionalIdArg) => {
        const level = levelsByProfessional.get(professionalIdArg);
        if (level == null) return null;
        return {
          id: 1,
          userId,
          professionalId: professionalIdArg,
          relationshipLevel: level,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }),
      findLevelsByUserAndProfessionals: mock(async () => levelsByProfessional),
      upsert: mock(async ({ relationshipLevel }) => {
        levelsByProfessional.set(professionalId, relationshipLevel);
        return {
          id: 1,
          userId,
          professionalId,
          relationshipLevel,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }),
      deleteByUserAndProfessional: mock(async () => {
        levelsByProfessional.delete(professionalId);
      }),
    };
  });

  it("lists professionals for all view and hydrates user relationship", async () => {
    levelsByProfessional.set(professionalId, 4);
    const useCase = new ListFacilityProfessionalsUseCase({
      facilityProfessionalRepository,
      userProfessionalRelationshipRepository,
    });

    const result = await useCase.execute({
      facilityId,
      scope: createGlobalScopeContext(),
      userId,
      view: "all",
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.association.confirmedAt).toBeUndefined();
    expect(result.data[0]?.association.relationshipLevel).toBe(4);
    expect(
      userProfessionalRelationshipRepository.findLevelsByUserAndProfessionals
    ).toHaveBeenCalledWith(userId, [professionalId]);
    expect(
      facilityProfessionalRepository.findActiveByFacilityWithProfessionals
    ).toHaveBeenCalledWith(expect.objectContaining({ facilityId, view: "all" }));
  });

  it("clears user relationship when relationshipLevel is null", async () => {
    levelsByProfessional.set(professionalId, 6);
    const useCase = new UpdateFacilityProfessionalRoleUseCase({
      facilityProfessionalRepository,
      userProfessionalRelationshipRepository,
    });

    const result = await useCase.execute({
      facilityId,
      professionalId,
      userId,
      scope: createGlobalScopeContext(),
      relationshipLevel: null,
    });

    expect(result?.relationshipLevel).toBeUndefined();
    expect(
      userProfessionalRelationshipRepository.deleteByUserAndProfessional
    ).toHaveBeenCalledWith(userId, professionalId);
  });

  it("returns composite professional facility context with user relationship", async () => {
    levelsByProfessional.set(professionalId, 7);
    const useCase = new GetFacilityProfessionalContextUseCase({
      facilityProfessionalRepository,
      professionalRepository,
      userProfessionalRelationshipRepository,
    });

    const result = await useCase.execute({
      facilityId,
      professionalId,
      userId,
      scope: createGlobalScopeContext(),
    });

    expect(result?.professional.taxId).toBe("52998224725");
    expect(result?.association.facilityId).toBe(facilityId);
    expect(result?.association.relationshipLevel).toBe(7);
    expect(result?.facilities).toEqual([{ id: facilityId, name: "Facility One" }]);
  });

  it("updates facility role flags and stores relationship as user×professional", async () => {
    const useCase = new UpdateFacilityProfessionalRoleUseCase({
      facilityProfessionalRepository,
      userProfessionalRelationshipRepository,
    });

    const result = await useCase.execute({
      facilityId,
      professionalId,
      userId,
      scope: createGlobalScopeContext(),
      isPartner: true,
      relationshipLevel: 8,
      notes: "Key contact",
    });

    expect(result?.isPartner).toBe(true);
    expect(result?.relationshipLevel).toBe(8);
    expect(result?.notes).toBe("Key contact");
    expect(facilityProfessionalRepository.updateAssociationRoles).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ relationshipLevel: 8 }),
      })
    );
    expect(userProfessionalRelationshipRepository.upsert).toHaveBeenCalledWith({
      userId,
      professionalId,
      relationshipLevel: 8,
    });
  });

  it("confirms a professional at facility", async () => {
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

  it("manually associates a professional", async () => {
    const useCase = new ManuallyAssociateProfessionalUseCase({
      facilityProfessionalRepository,
    });

    const result = await useCase.execute({
      facilityId,
      professionalId,
      userId,
      scope: createGlobalScopeContext(),
    });

    expect(result.confirmedAt).toBeTruthy();
  });

  it("ends a facility professional association", async () => {
    const useCase = new EndFacilityProfessionalUseCase({ facilityProfessionalRepository });

    const result = await useCase.execute({
      facilityId,
      professionalId,
      userId,
      scope: createGlobalScopeContext(),
    });

    expect(result?.endedAt).toBeTruthy();
  });
});
