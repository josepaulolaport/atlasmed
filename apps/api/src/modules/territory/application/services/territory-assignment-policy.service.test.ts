import { describe, expect, it, mock } from "bun:test";
import { Role } from "@atlasmed/access";
import { OperationNotAllowedError } from "../../../../shared/errors";
import { TerritoryAssignmentPolicyService } from "./territory-assignment-policy.service";
import type { TerritoryRepository } from "../interfaces/territory.repository.interface";
import type { TerritoryTypeRepository } from "../interfaces/territory-type.repository.interface";

const TERRITORY_ID = 1;
const TARGET_USER_ID = 100;
const OTHER_USER_ID = 200;

function buildService(options: {
  territoryTypeOverrides?: Partial<{ slug: string }>;
  territoryOverrides?: Partial<{ isActive: boolean }>;
  conflictingAssignments?: Array<{ userId: number }>;
} = {}) {
  const territoryRepository: Pick<TerritoryRepository, "findById" | "findConflictingAssignments"> = {
    findById: mock(async () => ({
      id: TERRITORY_ID,
      name: "Territory 1",
      slug: "patch",
      code: "T1",
      verticalId: 1,
      territoryTypeId: 1,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      managerTerritoryId: null,
      territoryType: {
        id: 1,
        slug: "patch",
        name: "Patch",
        description: null,
        canHaveBoundary: true,
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

  it("rejects assigning a REP when another REP already holds the patch", async () => {
    const { service, territoryRepository } = buildService({
      conflictingAssignments: [{ userId: OTHER_USER_ID }],
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
      territoryTypeOverrides: { slug: "manager_zone" },
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

  it("rejects assigning a REP to a non-patch territory type", async () => {
    const { service } = buildService({
      territoryTypeOverrides: { slug: "manager_zone" },
    });

    await expect(
      service.validateAssignment({
        targetUserId: TARGET_USER_ID,
        targetRole: Role.REP,
        territoryId: TERRITORY_ID,
      })
    ).rejects.toBeInstanceOf(OperationNotAllowedError);
  });

  it("rejects assigning a manager to a non-manager-zone territory type", async () => {
    const { service } = buildService({
      territoryTypeOverrides: { slug: "patch" },
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
