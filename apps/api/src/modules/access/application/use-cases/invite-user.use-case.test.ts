import { beforeEach, describe, expect, it, mock } from "bun:test";
import { createMockAuditLogService } from "../../test-helpers/audit-mocks";
import { createMockMetricsService } from "../../test-helpers/metrics-mocks";

const mockLogInviteUser = mock(async () => {});

mock.module("../../../../infrastructure/audit/audit-log.service", () => ({
  auditLogService: createMockAuditLogService({
    logInviteUser: mockLogInviteUser,
  }),
}));

import { InviteUserUseCase } from "./invite-user.use-case";
import type { InviteRepository } from "../interfaces/invite.repository.interface";
import type { UserRepository } from "../interfaces/user.repository.interface";
import type { RoleRepository } from "../interfaces/role.repository.interface";
import {
  ValidationError,
  RoleNotFoundError,
  EmailAlreadyExistsError,
  ResourceConflictError,
  InsufficientPermissionsError,
} from "../../../../shared/errors";
import {
  createGlobalScopeContext,
  withTerritoryScopeAliases,
  type ScopeContext,
} from "@atlasmed/access";
import { ForbiddenError } from "../../../../shared/errors";
import type { TerritoryCrudUseCases } from "../../../territory/application/use-cases/territory-crud.use-cases";
import { ROLE_PRIORITY_BY_NAME } from "../constants/role-priority.constants";
import { 
  createMockInviteRepository, 
  createMockUserRepository,
  createMockRoleRepository,
  createMockUserWithRole,
} from "../../test-helpers/fixtures";

type InviteParams = Parameters<InviteUserUseCase["execute"]>[0];

describe("InviteUserUseCase", () => {
  let inviteUserUseCase: InviteUserUseCase;

  /**
   * These cases exercise invite mechanics, not vertical authorization, so they
   * run as ADMIN (global scope). D-04 coverage lives in the dedicated
   * "new patch vertical authorization" block below.
   */
  function invite(params: Omit<InviteParams, "scope">) {
    return inviteUserUseCase.execute({
      ...params,
      scope: createGlobalScopeContext(),
    });
  }

  let mockInviteRepository: InviteRepository;
  let mockUserRepository: UserRepository;
  let mockRoleRepository: RoleRepository;

  const mockInvite = {
    id: 789,
    email: "newuser@example.com",
    phoneNumber: null,
    tokenHash: "hashed-token",
    roleId: 1,
    invitedByUserId: 456,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    status: "PENDING",
    createdAt: new Date(),
    acceptedAt: null,
    revokedAt: null,
    firstName: "Test",
    lastName: "User",
    birthDate: new Date("1990-05-12T00:00:00.000Z"),
    acceptedByUserId: null,
    resendCount: 0,
    lastResendAt: null,
    updatedAt: new Date(),
    role: {
      id: 1,
      name: "USER",
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  beforeEach(() => {
    mockInviteRepository = createMockInviteRepository({
      create: mock(async () => mockInvite) as any,
    });

    mockUserRepository = createMockUserRepository({
      findById: mock(async () =>
        createMockUserWithRole({
          user: { id: 456 },
          role: { id: 2, name: "ADMIN" },
        })
      ),
    });

    mockRoleRepository = createMockRoleRepository({
      findById: mock(async () => ({
        id: 1,
        name: "ADMIN",
        priority: ROLE_PRIORITY_BY_NAME.ADMIN,
      })),
    });

    inviteUserUseCase = new InviteUserUseCase({
      inviteRepository: mockInviteRepository,
      userRepository: mockUserRepository,
      roleRepository: mockRoleRepository,
      auditLog: createMockAuditLogService({
        logInviteUser: mockLogInviteUser,
      }),
      metrics: createMockMetricsService(),
    });
  });

  describe("invite creation", () => {
    it("should create invite with email", async () => {
      const params = {
        email: "newuser@example.com",
        roleId: 1,
        invitedByUserId: 456,
        birthDate: "1990-05-12",
        firstName: "Test",
        lastName: "User",
      };

      const result = await invite(params);

      expect(result).toHaveProperty("invite");
      expect(result).toHaveProperty("token");
      expect(mockLogInviteUser).toHaveBeenCalledWith({
        invitedByUserId: 456,
        inviteId: 789,
        email: "newuser@example.com",
        phoneNumber: undefined,
        roleId: 1,
      });
    });

    it("should create invite with phone number", async () => {
      const params = {
        phoneNumber: "+1234567890",
        roleId: 1,
        invitedByUserId: 456,
        birthDate: "1990-05-12",
        firstName: "Test",
        lastName: "User",
      };

      const result = await invite(params);

      expect(result).toHaveProperty("invite");
      expect(result).toHaveProperty("token");
    });

    it("should generate invite token", async () => {
      const result = await invite({
        email: "newuser@example.com",
        roleId: 1,
        invitedByUserId: 456,
        birthDate: "1990-05-12",
        firstName: "Test",
        lastName: "User",
      });

      expect(result.token).toBeString();
      expect(result.token.length).toBeGreaterThan(0);
    });

    it("should return invite object", async () => {
      const result = await invite({
        email: "newuser@example.com",
        roleId: 1,
        invitedByUserId: 456,
        birthDate: "1990-05-12",
        firstName: "Test",
        lastName: "User",
      });

      expect(result.invite).toEqual(mockInvite as any);
    });

    it("should link invite to role", async () => {
      const roleId = 789;

      await invite({
        email: "newuser@example.com",
        roleId,
        invitedByUserId: 456,
        birthDate: "1990-05-12",
        firstName: "Test",
        lastName: "User",
      });

      expect(mockInviteRepository.create).toHaveBeenCalled();
    });

    it("should link invite to inviter", async () => {
      const invitedByUserId = 999;

      await invite({
        email: "newuser@example.com",
        roleId: 1,
        invitedByUserId,
        birthDate: "1990-05-12",
        firstName: "Test",
        lastName: "User",
      });

      expect(mockInviteRepository.create).toHaveBeenCalled();
    });
  });

  describe("validation", () => {
    it("should throw error when neither email nor phoneNumber provided", async () => {
      await expect(
        invite({
          roleId: 1,
          invitedByUserId: 456,
        birthDate: "1990-05-12",
        firstName: "Test",
        lastName: "User",
        } as any)
      ).rejects.toThrow(ValidationError);
    });

    it("should throw error when roleId does not exist", async () => {
      mockRoleRepository.findById = mock(async () => null);

      await expect(
        invite({
          email: "user@example.com",
          roleId: 99999,
          invitedByUserId: 456,
        birthDate: "1990-05-12",
        firstName: "Test",
        lastName: "User",
        })
      ).rejects.toThrow(RoleNotFoundError);
    });

    it("should validate roleId before checking user existence", async () => {
      mockRoleRepository.findById = mock(async () => null);

      try {
        await invite({
          email: "user@example.com",
          roleId: 99999,
          invitedByUserId: 456,
        birthDate: "1990-05-12",
        firstName: "Test",
        lastName: "User",
        });
      } catch {}

      expect(mockRoleRepository.findById).toHaveBeenCalledWith(99999);
      expect(mockUserRepository.findById).not.toHaveBeenCalled();
      expect(mockUserRepository.findByIdentifier).not.toHaveBeenCalled();
    });

    it("should allow both email and phoneNumber", async () => {
      await expect(
        invite({
          email: "user@example.com",
          phoneNumber: "+1234567890",
          roleId: 1,
          invitedByUserId: 456,
        birthDate: "1990-05-12",
        firstName: "Test",
        lastName: "User",
        })
      ).resolves.toBeDefined();
    });
  });

  describe("existing user check", () => {
    it("should throw error when user already exists with email", async () => {
      mockUserRepository.findByIdentifier = mock(async () => ({
        id: "existing-user",
      })) as any;

      await expect(
        invite({
          email: "existing@example.com",
          roleId: 1,
          invitedByUserId: 456,
        birthDate: "1990-05-12",
        firstName: "Test",
        lastName: "User",
        })
      ).rejects.toThrow(EmailAlreadyExistsError);
    });

    it("should throw error when user already exists with phone number", async () => {
      mockUserRepository.findByIdentifier = mock(async () => ({
        id: "existing-user",
      })) as any;

      await expect(
        invite({
          phoneNumber: "+1234567890",
          roleId: 1,
          invitedByUserId: 456,
        birthDate: "1990-05-12",
        firstName: "Test",
        lastName: "User",
        })
      ).rejects.toThrow(ResourceConflictError);
    });

    it("should check user existence by email", async () => {
      const email = "newuser@example.com";

      await invite({
        email,
        roleId: 1,
        invitedByUserId: 456,
        birthDate: "1990-05-12",
        firstName: "Test",
        lastName: "User",
      });

      expect(mockUserRepository.findByIdentifier).toHaveBeenCalledWith({
        identifier: email,
      });
    });

    it("should check user existence by phone number", async () => {
      const phoneNumber = "+1234567890";

      await invite({
        phoneNumber,
        roleId: 1,
        invitedByUserId: 456,
        birthDate: "1990-05-12",
        firstName: "Test",
        lastName: "User",
      });

      expect(mockUserRepository.findByIdentifier).toHaveBeenCalledWith({
        identifier: phoneNumber,
      });
    });

    it("should not create invite when user already exists", async () => {
      mockUserRepository.findByIdentifier = mock(async () => ({
        id: "existing-user",
      })) as any;

      try {
        await invite({
          email: "existing@example.com",
          roleId: 1,
          invitedByUserId: 456,
        birthDate: "1990-05-12",
        firstName: "Test",
        lastName: "User",
        });
      } catch {}

      expect(mockInviteRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("existing invite check", () => {
    it("should throw error when active invite already exists for email", async () => {
      mockInviteRepository.findByEmailOrPhone = mock(async () => mockInvite) as any;

      await expect(
        invite({
          email: "newuser@example.com",
          roleId: 1,
          invitedByUserId: 456,
        birthDate: "1990-05-12",
        firstName: "Test",
        lastName: "User",
        })
      ).rejects.toThrow(ResourceConflictError);
    });

    it("should throw error when active invite already exists for phone", async () => {
      mockInviteRepository.findByEmailOrPhone = mock(async () => mockInvite) as any;

      await expect(
        invite({
          phoneNumber: "+1234567890",
          roleId: 1,
          invitedByUserId: 456,
        birthDate: "1990-05-12",
        firstName: "Test",
        lastName: "User",
        })
      ).rejects.toThrow(ResourceConflictError);
    });

    it("should check for existing invite by email", async () => {
      const email = "newuser@example.com";

      await invite({
        email,
        roleId: 1,
        invitedByUserId: 456,
        birthDate: "1990-05-12",
        firstName: "Test",
        lastName: "User",
      });

      expect(mockInviteRepository.findByEmailOrPhone).toHaveBeenCalledWith(
        email,
        undefined
      );
    });

    it("should check for existing invite by phone number", async () => {
      const phoneNumber = "+1234567890";

      await invite({
        phoneNumber,
        roleId: 1,
        invitedByUserId: 456,
        birthDate: "1990-05-12",
        firstName: "Test",
        lastName: "User",
      });

      expect(mockInviteRepository.findByEmailOrPhone).toHaveBeenCalledWith(
        undefined,
        phoneNumber
      );
    });

    it("should not create invite when active invite already exists", async () => {
      mockInviteRepository.findByEmailOrPhone = mock(async () => mockInvite) as any;

      try {
        await invite({
          email: "newuser@example.com",
          roleId: 1,
          invitedByUserId: 456,
        birthDate: "1990-05-12",
        firstName: "Test",
        lastName: "User",
        });
      } catch {}

      expect(mockInviteRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("role assignment ceiling", () => {
    const inviteParams = {
      email: "newuser@example.com",
      roleId: 5,
      invitedByUserId: 123,
        birthDate: "1990-05-12",
        firstName: "Test",
        lastName: "User",
    };

    function setupInviter(roleName: keyof typeof ROLE_PRIORITY_BY_NAME) {
      mockUserRepository.findById = mock(async () =>
        createMockUserWithRole({
          user: { id: 123 },
          role: {
            name: roleName,
            priority: ROLE_PRIORITY_BY_NAME[roleName],
          },
        })
      );
    }

    function setupTargetRole(roleName: keyof typeof ROLE_PRIORITY_BY_NAME) {
      mockRoleRepository.findById = mock(async () => ({
        id: 5,
        name: roleName,
        priority: ROLE_PRIORITY_BY_NAME[roleName],
      }));
    }

    it("should allow MANAGER to invite REP", async () => {
      setupInviter("MANAGER");
      setupTargetRole("REP");

      await expect(
        invite({
          ...inviteParams,
          verticalAssignments: [
            {
              verticalId: 1,
              territoryIds: [21],
            },
          ],
        })
      ).resolves.toBeDefined();
    });

    it("should reject MANAGER inviting MANAGER", async () => {
      setupInviter("MANAGER");
      setupTargetRole("MANAGER");

      await expect(invite(inviteParams)).rejects.toThrow(
        InsufficientPermissionsError
      );
    });

    it("should reject MANAGER inviting ADMIN", async () => {
      setupInviter("MANAGER");
      setupTargetRole("ADMIN");

      await expect(invite(inviteParams)).rejects.toThrow(
        InsufficientPermissionsError
      );
    });

    it("should allow ADMIN to invite ADMIN", async () => {
      setupInviter("ADMIN");
      setupTargetRole("ADMIN");

      await expect(
        invite({
          ...inviteParams,
          invitedByUserId: 456,
        birthDate: "1990-05-12",
        firstName: "Test",
        lastName: "User",
        })
      ).resolves.toBeDefined();
    });

    it("should not create invite when role rank exceeds inviter", async () => {
      setupInviter("MANAGER");
      setupTargetRole("ADMIN");

      try {
        await invite(inviteParams);
      } catch {}

      expect(mockInviteRepository.create).not.toHaveBeenCalled();
    });
  });

  // D-04 / spec 0010 §2.2 — `newPatch` creates a real territory. A MANAGER holds
  // `create INVITATION`, so the invite flow is a second door into territory
  // creation and must enforce the same vertical rule as POST /territories.
  describe("new patch vertical authorization", () => {
    const PATCH_TYPE = {
      id: 2,
      slug: "patch",
      name: "Rep patch",
      description: null,
      canHaveBoundary: true,
      blockSiblingOverlap: true,
      isActive: true,
    };

    let createTerritoryRow: ReturnType<typeof mock>;

    /** MANAGER assigned to vertical 1 only. */
    function managerScope(verticalIds: number[]): ScopeContext {
      return withTerritoryScopeAliases({
        isGlobal: false,
        assignedTerritoryIds: [10],
        effectiveTerritoryIds: [10],
        analyticsEffectiveTerritoryIds: [],
        facilityIds: [],
        analyticsFacilityIds: [],
        managedUserIds: [],
        assignedVerticalIds: verticalIds,
        isOperationallyActive: true,
      });
    }

    function newPatchAssignment(verticalId: number) {
      return [
        {
          verticalId,
          territoryIds: [],
          newPatch: {
            name: "Patch Norte",
            managerZoneId: 10,
            boundary: {
              type: "Polygon" as const,
              coordinates: [
                [
                  [0, 0],
                  [0, 1],
                  [1, 1],
                  [0, 0],
                ],
              ],
            },
          },
        },
      ];
    }

    beforeEach(async () => {
      const { TerritoryCrudUseCases } = await import(
        "../../../territory/application/use-cases/territory-crud.use-cases"
      );

      createTerritoryRow = mock(async () => {
        throw new Error("territory row created");
      });

      const territoryCrud = new TerritoryCrudUseCases({
        territoryRepository: {
          findBySlug: async () => null,
          create: createTerritoryRow,
        } as never,
        territoryTypeRepository: {
          findBySlug: async () => PATCH_TYPE,
          findById: async () => PATCH_TYPE,
        } as never,
        spatialRepository: {} as never,
        containmentService: {} as never,
      }) as TerritoryCrudUseCases;

      mockUserRepository.findById = mock(async () =>
        createMockUserWithRole({
          user: { id: 123 },
          role: { name: "MANAGER", priority: ROLE_PRIORITY_BY_NAME.MANAGER },
        })
      );
      mockRoleRepository.findById = mock(async () => ({
        id: 5,
        name: "REP",
        priority: ROLE_PRIORITY_BY_NAME.REP,
      }));

      inviteUserUseCase = new InviteUserUseCase({
        inviteRepository: mockInviteRepository,
        userRepository: mockUserRepository,
        roleRepository: mockRoleRepository,
        territoryCrud,
        auditLog: createMockAuditLogService({
          logInviteUser: mockLogInviteUser,
        }),
        metrics: createMockMetricsService(),
      });
    });

    it("rejects a newPatch in a vertical the inviter is not assigned to", async () => {
      await expect(
        inviteUserUseCase.execute({
          email: "rep@example.com",
          roleId: 5,
          invitedByUserId: 123,
          birthDate: "1990-05-12",
          firstName: "Test",
          lastName: "User",
          verticalAssignments: newPatchAssignment(2),
          scope: managerScope([1]),
        })
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("does not create the territory row when the vertical is refused", async () => {
      try {
        await inviteUserUseCase.execute({
          email: "rep@example.com",
          roleId: 5,
          invitedByUserId: 123,
          birthDate: "1990-05-12",
          firstName: "Test",
          lastName: "User",
          verticalAssignments: newPatchAssignment(2),
          scope: managerScope([1]),
        });
      } catch {}

      expect(createTerritoryRow).not.toHaveBeenCalled();
      expect(mockInviteRepository.create).not.toHaveBeenCalled();
    });

    it("allows a newPatch in a vertical the inviter is assigned to", async () => {
      // Passes the vertical guard and reaches territory persistence, which the
      // fake rejects — proving the guard itself did not refuse the manager.
      await expect(
        inviteUserUseCase.execute({
          email: "rep@example.com",
          roleId: 5,
          invitedByUserId: 123,
          birthDate: "1990-05-12",
          firstName: "Test",
          lastName: "User",
          verticalAssignments: newPatchAssignment(1),
          scope: managerScope([1]),
        })
      ).rejects.toThrow("territory row created");
      expect(createTerritoryRow).toHaveBeenCalled();
    });
  });

  describe("repository failures", () => {
    it("should propagate error when findByIdentifier fails", async () => {
      mockUserRepository.findByIdentifier = mock(async () => {
        throw new Error("Database error");
      });

      await expect(
        invite({
          email: "user@example.com",
          roleId: 1,
          invitedByUserId: 456,
        birthDate: "1990-05-12",
        firstName: "Test",
        lastName: "User",
        })
      ).rejects.toThrow("Database error");
    });

    it("should propagate error when findByEmailOrPhone fails", async () => {
      mockInviteRepository.findByEmailOrPhone = mock(async () => {
        throw new Error("Query failed");
      });

      await expect(
        invite({
          email: "user@example.com",
          roleId: 1,
          invitedByUserId: 456,
        birthDate: "1990-05-12",
        firstName: "Test",
        lastName: "User",
        })
      ).rejects.toThrow("Query failed");
    });

    it("should propagate error when create fails", async () => {
      mockInviteRepository.create = mock(async () => {
        throw new Error("Create failed");
      });

      await expect(
        invite({
          email: "user@example.com",
          roleId: 1,
          invitedByUserId: 456,
        birthDate: "1990-05-12",
        firstName: "Test",
        lastName: "User",
        })
      ).rejects.toThrow("Create failed");
    });
  });
});
