import { describe, expect, it, mock } from "bun:test";
import { Role } from "@atlasmed/access";
import { OperationNotAllowedError } from "../../../../shared/errors";
import { TerritoryAssignmentPolicyService } from "./territory-assignment-policy.service";
import type { TerritoryRepository } from "../interfaces/territory.repository.interface";
import type { TerritoryTypeRepository } from "../interfaces/territory-type.repository.interface";

const TERRITORY_ID = "territory-1";
const TARGET_USER_ID = "user-target";

function buildService(options: {
  territoryTypeOverrides?: Partial<{
    assignsClinics: boolean;
    assignableToUsers: boolean;
    assignableToManagers: boolean;
  }>;
  territoryOverrides?: Partial<{ isActive: boolean }>;
  conflictingAssignments?: Array<{ userId: string }>;
} = {}) {
  const territoryRepository: Pick<TerritoryRepository, "findById" | "findConflictingAssignments"> = {
    findById: mock(async () => ({
      id: TERRITORY_ID,
      name: "Territory 1",
      slug: "territory-1",
      code: "T1",
      territoryTypeId: "type-1",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      managerTerritoryId: null,
      territoryType: {
        id: "type-1",
        slug: "patch",
        name: "Patch",
        description: null,
        canHaveBoundary: true,
        assignsClinics: true,
        assignableToUsers: true,
        assignableToManagers: false,
        blockSiblingOverlap: false,
        sortOrder: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...options.territoryTypeOverrides,
      },
      ...options.territoryOverrides,
    })),
    findConflictingAssignments: mock(async () => options.conflictingAssignments ?? []),
  };

  const territoryTypeRepository: Pick<TerritoryTypeRepository, "findById"> = {
    findById: mock(async () => null),
  };

  const service = new TerritoryAssignmentPolicyService({
    territoryRepository: territoryRepository as TerritoryRepository,
    territoryTypeRepository: territoryTypeRepository as TerritoryTypeRepository,
  });

  return { service, territoryRepository };
}

describe("TerritoryAssignmentPolicyService", () => {
  it("allows assigning a REP when no conflicting REP assignment exists", async () => {
    const { service } = buildService({ conflictingAssignments: [] });

    await expect(
      service.validateAssignment({
        targetUserId: TARGET_USER_ID,
        targetRole: Role.REP,
        territoryId: TERRITORY_ID,
      })
    ).resolves.toBeUndefined();
  });

  it("rejects assigning a REP when another REP already holds the territory", async () => {
    const { service, territoryRepository } = buildService({
      conflictingAssignments: [{ userId: "other-user" }],
    });

    await expect(
      service.validateAssignment({
        targetUserId: TARGET_USER_ID,
        targetRole: Role.REP,
        territoryId: TERRITORY_ID,
      })
    ).rejects.toBeInstanceOf(OperationNotAllowedError);

    expect(territoryRepository.findConflictingAssignments).toHaveBeenCalledWith({
      territoryId: TERRITORY_ID,
      excludeUserId: TARGET_USER_ID,
      roles: [Role.REP],
    });
  });

  it("allows the same user to re-take a territory they already hold — self-overlap is not blocked", async () => {
    const { service } = buildService({ conflictingAssignments: [] });

    await expect(
      service.validateAssignment({
        targetUserId: TARGET_USER_ID,
        targetRole: Role.REP,
        territoryId: TERRITORY_ID,
      })
    ).resolves.toBeUndefined();
  });

  it("checks for MANAGER conflicts (not REP) when assigning a manager", async () => {
    const { service, territoryRepository } = buildService({
      territoryTypeOverrides: { assignableToManagers: true },
      conflictingAssignments: [],
    });

    await service.validateAssignment({
      targetUserId: TARGET_USER_ID,
      targetRole: Role.MANAGER,
      territoryId: TERRITORY_ID,
    });

    expect(territoryRepository.findConflictingAssignments).toHaveBeenCalledWith({
      territoryId: TERRITORY_ID,
      excludeUserId: TARGET_USER_ID,
      roles: [Role.MANAGER],
    });
  });

  it("rejects when the territory does not exist or is inactive", async () => {
    const { service } = buildService();
    (service as unknown as { deps: { territoryRepository: TerritoryRepository } }).deps.territoryRepository.findById =
      mock(async () => null);

    await expect(
      service.validateAssignment({
        targetUserId: TARGET_USER_ID,
        targetRole: Role.REP,
        territoryId: TERRITORY_ID,
      })
    ).rejects.toBeInstanceOf(OperationNotAllowedError);
  });

  it("rejects assigning a REP to a type that is not assignable to users", async () => {
    const { service } = buildService({
      territoryTypeOverrides: { assignableToUsers: false },
    });

    await expect(
      service.validateAssignment({
        targetUserId: TARGET_USER_ID,
        targetRole: Role.REP,
        territoryId: TERRITORY_ID,
      })
    ).rejects.toBeInstanceOf(OperationNotAllowedError);
  });

  it("rejects assigning a manager to a type that is not assignable to managers", async () => {
    const { service } = buildService({
      territoryTypeOverrides: { assignableToManagers: false },
    });

    await expect(
      service.validateAssignment({
        targetUserId: TARGET_USER_ID,
        targetRole: Role.MANAGER,
        territoryId: TERRITORY_ID,
      })
    ).rejects.toBeInstanceOf(OperationNotAllowedError);
  });

  it("rejects roles other than REP or MANAGER", async () => {
    const { service } = buildService();

    await expect(
      service.validateAssignment({
        targetUserId: TARGET_USER_ID,
        targetRole: Role.ADMIN,
        territoryId: TERRITORY_ID,
      })
    ).rejects.toBeInstanceOf(OperationNotAllowedError);
  });
});
