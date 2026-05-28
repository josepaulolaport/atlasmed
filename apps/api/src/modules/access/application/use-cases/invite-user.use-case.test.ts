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
import { ROLE_PRIORITY_BY_NAME } from "../constants/role-priority.constants";
import { 
  createMockInviteRepository, 
  createMockUserRepository,
  createMockRoleRepository,
  createMockUserWithRole,
} from "../../test-helpers/fixtures";

describe("InviteUserUseCase", () => {
  let inviteUserUseCase: InviteUserUseCase;
  let mockInviteRepository: InviteRepository;
  let mockUserRepository: UserRepository;
  let mockRoleRepository: RoleRepository;

  const mockInvite = {
    id: "invite-123",
    email: "newuser@example.com",
    phoneNumber: null,
    tokenHash: "hashed-token",
    roleId: "role-123",
    invitedByUserId: "admin-456",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    status: "PENDING",
    createdAt: new Date(),
    acceptedAt: null,
    revokedAt: null,
    role: {
      id: "role-123",
      name: "USER",
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  beforeEach(() => {
    mockInviteRepository = createMockInviteRepository({
      create: mock(async () => mockInvite),
    });

    mockUserRepository = createMockUserRepository({
      findById: mock(async () =>
        createMockUserWithRole({
          user: { id: "admin-456" },
          role: { id: "role-admin", name: "ADMIN" },
        })
      ),
    });

    mockRoleRepository = createMockRoleRepository();

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
        roleId: "role-123",
        invitedByUserId: "admin-456",
      };

      const result = await inviteUserUseCase.execute(params);

      expect(result).toHaveProperty("invite");
      expect(result).toHaveProperty("token");
      expect(mockLogInviteUser).toHaveBeenCalledWith({
        invitedByUserId: "admin-456",
        inviteId: "invite-123",
        email: "newuser@example.com",
        phoneNumber: undefined,
        roleId: "role-123",
      });
    });

    it("should create invite with phone number", async () => {
      const params = {
        phoneNumber: "+1234567890",
        roleId: "role-123",
        invitedByUserId: "admin-456",
      };

      const result = await inviteUserUseCase.execute(params);

      expect(result).toHaveProperty("invite");
      expect(result).toHaveProperty("token");
    });

    it("should generate invite token", async () => {
      const result = await inviteUserUseCase.execute({
        email: "newuser@example.com",
        roleId: "role-123",
        invitedByUserId: "admin-456",
      });

      expect(result.token).toBeString();
      expect(result.token.length).toBeGreaterThan(0);
    });

    it("should return invite object", async () => {
      const result = await inviteUserUseCase.execute({
        email: "newuser@example.com",
        roleId: "role-123",
        invitedByUserId: "admin-456",
      });

      expect(result.invite).toEqual(mockInvite);
    });

    it("should link invite to role", async () => {
      const roleId = "role-789";

      await inviteUserUseCase.execute({
        email: "newuser@example.com",
        roleId,
        invitedByUserId: "admin-456",
      });

      expect(mockInviteRepository.create).toHaveBeenCalled();
    });

    it("should link invite to inviter", async () => {
      const invitedByUserId = "admin-999";

      await inviteUserUseCase.execute({
        email: "newuser@example.com",
        roleId: "role-123",
        invitedByUserId,
      });

      expect(mockInviteRepository.create).toHaveBeenCalled();
    });
  });

  describe("validation", () => {
    it("should throw error when neither email nor phoneNumber provided", async () => {
      await expect(
        inviteUserUseCase.execute({
          roleId: "role-123",
          invitedByUserId: "admin-456",
        } as any)
      ).rejects.toThrow(ValidationError);
    });

    it("should throw error when roleId does not exist", async () => {
      mockRoleRepository.findById = mock(async () => null);

      await expect(
        inviteUserUseCase.execute({
          email: "user@example.com",
          roleId: "invalid-role-id",
          invitedByUserId: "admin-456",
        })
      ).rejects.toThrow(RoleNotFoundError);
    });

    it("should validate roleId before checking user existence", async () => {
      mockRoleRepository.findById = mock(async () => null);

      try {
        await inviteUserUseCase.execute({
          email: "user@example.com",
          roleId: "invalid-role-id",
          invitedByUserId: "admin-456",
        });
      } catch {}

      expect(mockRoleRepository.findById).toHaveBeenCalledWith("invalid-role-id");
      expect(mockUserRepository.findById).not.toHaveBeenCalled();
      expect(mockUserRepository.findByIdentifier).not.toHaveBeenCalled();
    });

    it("should allow both email and phoneNumber", async () => {
      await expect(
        inviteUserUseCase.execute({
          email: "user@example.com",
          phoneNumber: "+1234567890",
          roleId: "role-123",
          invitedByUserId: "admin-456",
        })
      ).resolves.toBeDefined();
    });
  });

  describe("existing user check", () => {
    it("should throw error when user already exists with email", async () => {
      mockUserRepository.findByIdentifier = mock(async () => ({
        id: "existing-user",
      }));

      await expect(
        inviteUserUseCase.execute({
          email: "existing@example.com",
          roleId: "role-123",
          invitedByUserId: "admin-456",
        })
      ).rejects.toThrow(EmailAlreadyExistsError);
    });

    it("should throw error when user already exists with phone number", async () => {
      mockUserRepository.findByIdentifier = mock(async () => ({
        id: "existing-user",
      }));

      await expect(
        inviteUserUseCase.execute({
          phoneNumber: "+1234567890",
          roleId: "role-123",
          invitedByUserId: "admin-456",
        })
      ).rejects.toThrow(ResourceConflictError);
    });

    it("should check user existence by email", async () => {
      const email = "newuser@example.com";

      await inviteUserUseCase.execute({
        email,
        roleId: "role-123",
        invitedByUserId: "admin-456",
      });

      expect(mockUserRepository.findByIdentifier).toHaveBeenCalledWith({
        identifier: email,
      });
    });

    it("should check user existence by phone number", async () => {
      const phoneNumber = "+1234567890";

      await inviteUserUseCase.execute({
        phoneNumber,
        roleId: "role-123",
        invitedByUserId: "admin-456",
      });

      expect(mockUserRepository.findByIdentifier).toHaveBeenCalledWith({
        identifier: phoneNumber,
      });
    });

    it("should not create invite when user already exists", async () => {
      mockUserRepository.findByIdentifier = mock(async () => ({
        id: "existing-user",
      }));

      try {
        await inviteUserUseCase.execute({
          email: "existing@example.com",
          roleId: "role-123",
          invitedByUserId: "admin-456",
        });
      } catch {}

      expect(mockInviteRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("existing invite check", () => {
    it("should throw error when active invite already exists for email", async () => {
      mockInviteRepository.findByEmailOrPhone = mock(async () => mockInvite);

      await expect(
        inviteUserUseCase.execute({
          email: "newuser@example.com",
          roleId: "role-123",
          invitedByUserId: "admin-456",
        })
      ).rejects.toThrow(ResourceConflictError);
    });

    it("should throw error when active invite already exists for phone", async () => {
      mockInviteRepository.findByEmailOrPhone = mock(async () => mockInvite);

      await expect(
        inviteUserUseCase.execute({
          phoneNumber: "+1234567890",
          roleId: "role-123",
          invitedByUserId: "admin-456",
        })
      ).rejects.toThrow(ResourceConflictError);
    });

    it("should check for existing invite by email", async () => {
      const email = "newuser@example.com";

      await inviteUserUseCase.execute({
        email,
        roleId: "role-123",
        invitedByUserId: "admin-456",
      });

      expect(mockInviteRepository.findByEmailOrPhone).toHaveBeenCalledWith(
        email,
        undefined
      );
    });

    it("should check for existing invite by phone number", async () => {
      const phoneNumber = "+1234567890";

      await inviteUserUseCase.execute({
        phoneNumber,
        roleId: "role-123",
        invitedByUserId: "admin-456",
      });

      expect(mockInviteRepository.findByEmailOrPhone).toHaveBeenCalledWith(
        undefined,
        phoneNumber
      );
    });

    it("should not create invite when active invite already exists", async () => {
      mockInviteRepository.findByEmailOrPhone = mock(async () => mockInvite);

      try {
        await inviteUserUseCase.execute({
          email: "newuser@example.com",
          roleId: "role-123",
          invitedByUserId: "admin-456",
        });
      } catch {}

      expect(mockInviteRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("role assignment ceiling", () => {
    const inviteParams = {
      email: "newuser@example.com",
      roleId: "role-target",
      invitedByUserId: "manager-123",
    };

    function setupInviter(roleName: keyof typeof ROLE_PRIORITY_BY_NAME) {
      mockUserRepository.findById = mock(async () =>
        createMockUserWithRole({
          user: { id: "manager-123" },
          role: {
            name: roleName,
            priority: ROLE_PRIORITY_BY_NAME[roleName],
          },
        })
      );
    }

    function setupTargetRole(roleName: keyof typeof ROLE_PRIORITY_BY_NAME) {
      mockRoleRepository.findById = mock(async () => ({
        id: "role-target",
        name: roleName,
        priority: ROLE_PRIORITY_BY_NAME[roleName],
      }));
    }

    it("should allow MANAGER to invite USER", async () => {
      setupInviter("MANAGER");
      setupTargetRole("USER");

      await expect(inviteUserUseCase.execute(inviteParams)).resolves.toBeDefined();
    });

    it("should reject MANAGER inviting MANAGER", async () => {
      setupInviter("MANAGER");
      setupTargetRole("MANAGER");

      await expect(inviteUserUseCase.execute(inviteParams)).rejects.toThrow(
        InsufficientPermissionsError
      );
    });

    it("should reject MANAGER inviting ADMIN", async () => {
      setupInviter("MANAGER");
      setupTargetRole("ADMIN");

      await expect(inviteUserUseCase.execute(inviteParams)).rejects.toThrow(
        InsufficientPermissionsError
      );
    });

    it("should allow ADMIN to invite ADMIN", async () => {
      setupInviter("ADMIN");
      setupTargetRole("ADMIN");

      await expect(
        inviteUserUseCase.execute({
          ...inviteParams,
          invitedByUserId: "admin-456",
        })
      ).resolves.toBeDefined();
    });

    it("should not create invite when role rank exceeds inviter", async () => {
      setupInviter("MANAGER");
      setupTargetRole("ADMIN");

      try {
        await inviteUserUseCase.execute(inviteParams);
      } catch {}

      expect(mockInviteRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("repository failures", () => {
    it("should propagate error when findByIdentifier fails", async () => {
      mockUserRepository.findByIdentifier = mock(async () => {
        throw new Error("Database error");
      });

      await expect(
        inviteUserUseCase.execute({
          email: "user@example.com",
          roleId: "role-123",
          invitedByUserId: "admin-456",
        })
      ).rejects.toThrow("Database error");
    });

    it("should propagate error when findByEmailOrPhone fails", async () => {
      mockInviteRepository.findByEmailOrPhone = mock(async () => {
        throw new Error("Query failed");
      });

      await expect(
        inviteUserUseCase.execute({
          email: "user@example.com",
          roleId: "role-123",
          invitedByUserId: "admin-456",
        })
      ).rejects.toThrow("Query failed");
    });

    it("should propagate error when create fails", async () => {
      mockInviteRepository.create = mock(async () => {
        throw new Error("Create failed");
      });

      await expect(
        inviteUserUseCase.execute({
          email: "user@example.com",
          roleId: "role-123",
          invitedByUserId: "admin-456",
        })
      ).rejects.toThrow("Create failed");
    });
  });
});
