import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Role } from "@atlasmed/access";
import { RevokeInviteUseCase } from "./revoke-invite.use-case";
import type { InviteRepository } from "../interfaces/invite.repository.interface";
import { createMockInviteRepository } from "../../test-helpers/fixtures";
import { createMockAuditLogService } from "../../test-helpers/audit-mocks";
import { ForbiddenError } from "../../../../shared/errors";

describe("RevokeInviteUseCase", () => {
  let revokeInviteUseCase: RevokeInviteUseCase;
  let mockInviteRepository: InviteRepository;

  const mockPendingInvite = {
    id: "invite-123",
    email: "user@example.com",
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
      findById: mock(async () => mockPendingInvite),
    });

    revokeInviteUseCase = new RevokeInviteUseCase({
      inviteRepository: mockInviteRepository,
      auditLog: createMockAuditLogService(),
    });
  });

  describe("revoke invite", () => {
    it("should revoke pending invite", async () => {
      await revokeInviteUseCase.execute({
        inviteId: "invite-123",
        revokedByUserId: "admin-456",
        actorRole: Role.ADMIN,
      });

      expect(mockInviteRepository.revoke).toHaveBeenCalledTimes(1);
      expect(mockInviteRepository.revoke).toHaveBeenCalledWith("invite-123");
    });

    it("should complete successfully when invite is revoked", async () => {
      await expect(
        revokeInviteUseCase.execute({
          inviteId: "invite-123",
          revokedByUserId: "admin-456",
          actorRole: Role.ADMIN,
        })
      ).resolves.toBeUndefined();
    });
  });

  describe("invite not found", () => {
    it("should throw error when invite not found", async () => {
      mockInviteRepository.findById = mock(async () => null);

      await expect(
        revokeInviteUseCase.execute({
          inviteId: "non-existent",
          revokedByUserId: "admin-456",
          actorRole: Role.ADMIN,
        })
      ).rejects.toThrow("Invite not found");
    });

    it("should not call revoke when invite not found", async () => {
      mockInviteRepository.findById = mock(async () => null);

      try {
        await revokeInviteUseCase.execute({
          inviteId: "non-existent",
          revokedByUserId: "admin-456",
          actorRole: Role.ADMIN,
        });
      } catch {}

      expect(mockInviteRepository.revoke).not.toHaveBeenCalled();
    });
  });

  describe("non-pending invite", () => {
    it("should throw error when invite is already accepted", async () => {
      mockInviteRepository.findById = mock(async () => ({
        ...mockPendingInvite,
        status: "ACCEPTED",
        acceptedAt: new Date(),
      }));

      await expect(
        revokeInviteUseCase.execute({
          inviteId: "invite-123",
          revokedByUserId: "admin-456",
          actorRole: Role.ADMIN,
        })
      ).rejects.toThrow("Only pending invites can be revoked");
    });

    it("should throw error when invite is already revoked", async () => {
      mockInviteRepository.findById = mock(async () => ({
        ...mockPendingInvite,
        status: "REVOKED",
        revokedAt: new Date(),
      }));

      await expect(
        revokeInviteUseCase.execute({
          inviteId: "invite-123",
          revokedByUserId: "admin-456",
          actorRole: Role.ADMIN,
        })
      ).rejects.toThrow("Only pending invites can be revoked");
    });

    it("should not call revoke when invite is accepted", async () => {
      mockInviteRepository.findById = mock(async () => ({
        ...mockPendingInvite,
        status: "ACCEPTED",
      }));

      try {
        await revokeInviteUseCase.execute({
        inviteId: "invite-123",
        revokedByUserId: "admin-456",
        actorRole: Role.ADMIN,
      });
      } catch {}

      expect(mockInviteRepository.revoke).not.toHaveBeenCalled();
    });

    it("should not call revoke when invite is already revoked", async () => {
      mockInviteRepository.findById = mock(async () => ({
        ...mockPendingInvite,
        status: "REVOKED",
      }));

      try {
        await revokeInviteUseCase.execute({
        inviteId: "invite-123",
        revokedByUserId: "admin-456",
        actorRole: Role.ADMIN,
      });
      } catch {}

      expect(mockInviteRepository.revoke).not.toHaveBeenCalled();
    });
  });

  describe("manager ownership", () => {
    it("should reject when manager revokes another manager invite", async () => {
      await expect(
        revokeInviteUseCase.execute({
          inviteId: "invite-123",
          revokedByUserId: "other-manager",
          actorRole: Role.MANAGER,
        })
      ).rejects.toThrow(ForbiddenError);

      expect(mockInviteRepository.revoke).not.toHaveBeenCalled();
    });

    it("should allow manager to revoke own invite", async () => {
      await revokeInviteUseCase.execute({
        inviteId: "invite-123",
        revokedByUserId: "admin-456",
        actorRole: Role.MANAGER,
      });

      expect(mockInviteRepository.revoke).toHaveBeenCalledWith("invite-123");
    });
  });

  describe("repository failures", () => {
    it("should propagate error when findById fails", async () => {
      mockInviteRepository.findById = mock(async () => {
        throw new Error("Database error");
      });

      await expect(
        revokeInviteUseCase.execute({
          inviteId: "invite-123",
          revokedByUserId: "admin-456",
          actorRole: Role.ADMIN,
        })
      ).rejects.toThrow("Database error");
    });

    it("should propagate error when revoke fails", async () => {
      mockInviteRepository.revoke = mock(async () => {
        throw new Error("Revoke failed");
      });

      await expect(
        revokeInviteUseCase.execute({
          inviteId: "invite-123",
          revokedByUserId: "admin-456",
          actorRole: Role.ADMIN,
        })
      ).rejects.toThrow("Revoke failed");
    });
  });
});
