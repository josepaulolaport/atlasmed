import { beforeEach, describe, expect, it, mock } from "bun:test";
import { InviteService } from "./invite.service";
import type { InviteRepository } from "../interfaces/invite.repository.interface";
import { createMockInviteRepository } from "../../test-helpers/fixtures";
import { hashToken } from "../../../../shared/utils/hash-token";

describe("InviteService", () => {
  let inviteService: InviteService;
  let mockInviteRepository: InviteRepository;

  beforeEach(() => {
    mockInviteRepository = createMockInviteRepository({
      create: mock(async (params) => ({
        id: "invite-123",
        email: params.email,
        phoneNumber: params.phoneNumber,
        tokenHash: params.tokenHash,
        roleId: params.roleId,
        invitedByUserId: params.invitedByUserId,
        expiresAt: params.expiresAt,
        status: "PENDING",
        createdAt: new Date(),
        acceptedAt: null,
        revokedAt: null,
        role: {
          id: params.roleId,
          name: "USER",
          description: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      })),
    });

    inviteService = new InviteService({
      inviteRepository: mockInviteRepository,
    });
  });

  describe("createInvite", () => {
    it("should create an invite with email", async () => {
      const params = {
        email: "user@example.com",
        roleId: "role-123",
        invitedByUserId: "admin-456",
      };

      const result = await inviteService.createInvite(params);

      expect(mockInviteRepository.create).toHaveBeenCalledTimes(1);
      const createCall = (mockInviteRepository.create as any).mock.calls[0][0];
      expect(createCall.email).toBe("user@example.com");
    });

    it("should create an invite with phoneNumber", async () => {
      const params = {
        phoneNumber: "+1234567890",
        roleId: "role-123",
        invitedByUserId: "admin-456",
      };

      const result = await inviteService.createInvite(params);

      const createCall = (mockInviteRepository.create as any).mock.calls[0][0];
      expect(createCall.phoneNumber).toBe("+1234567890");
    });

    it("should generate an invite token", async () => {
      const result = await inviteService.createInvite({
        email: "user@example.com",
        roleId: "role-123",
        invitedByUserId: "admin-456",
      });

      expect(result.token).toBeString();
      expect(result.token.length).toBeGreaterThan(0);
    });

    it("should store HASHED token only", async () => {
      const result = await inviteService.createInvite({
        email: "user@example.com",
        roleId: "role-123",
        invitedByUserId: "admin-456",
      });

      const createCall = (mockInviteRepository.create as any).mock.calls[0][0];
      expect(createCall.tokenHash).not.toBe(result.token);
      expect(createCall.tokenHash).toBe(hashToken(result.token));
    });

    it("should set expiration to 7 days from now", async () => {
      const beforeCreate = Date.now();
      await inviteService.createInvite({
        email: "user@example.com",
        roleId: "role-123",
        invitedByUserId: "admin-456",
      });
      const afterCreate = Date.now();

      const createCall = (mockInviteRepository.create as any).mock.calls[0][0];
      const expiresAt = createCall.expiresAt.getTime();

      const expectedMin = beforeCreate + 7 * 24 * 60 * 60 * 1000;
      const expectedMax = afterCreate + 7 * 24 * 60 * 60 * 1000;

      expect(expiresAt).toBeGreaterThanOrEqual(expectedMin);
      expect(expiresAt).toBeLessThanOrEqual(expectedMax);
    });

    it("should include roleId in invite", async () => {
      const roleId = "role-789";

      await inviteService.createInvite({
        email: "user@example.com",
        roleId,
        invitedByUserId: "admin-456",
      });

      const createCall = (mockInviteRepository.create as any).mock.calls[0][0];
      expect(createCall.roleId).toBe(roleId);
    });

    it("should include invitedByUserId in invite", async () => {
      const invitedByUserId = "admin-999";

      await inviteService.createInvite({
        email: "user@example.com",
        roleId: "role-123",
        invitedByUserId,
      });

      const createCall = (mockInviteRepository.create as any).mock.calls[0][0];
      expect(createCall.invitedByUserId).toBe(invitedByUserId);
    });

    it("should generate unique tokens for different invites", async () => {
      const result1 = await inviteService.createInvite({
        email: "user1@example.com",
        roleId: "role-123",
        invitedByUserId: "admin-456",
      });

      const result2 = await inviteService.createInvite({
        email: "user2@example.com",
        roleId: "role-123",
        invitedByUserId: "admin-456",
      });

      expect(result1.token).not.toBe(result2.token);
    });

    it("should return invite and token", async () => {
      const result = await inviteService.createInvite({
        email: "user@example.com",
        roleId: "role-123",
        invitedByUserId: "admin-456",
      });

      expect(result).toHaveProperty("invite");
      expect(result).toHaveProperty("token");
      expect(result.invite).toHaveProperty("id");
      expect(result.invite).toHaveProperty("email");
      expect(result.invite).toHaveProperty("tokenHash");
    });

    it("should handle undefined email when phoneNumber is provided", async () => {
      await inviteService.createInvite({
        email: undefined,
        phoneNumber: "+1234567890",
        roleId: "role-123",
        invitedByUserId: "admin-456",
      });

      const createCall = (mockInviteRepository.create as any).mock.calls[0][0];
      expect(createCall.email).toBeUndefined();
      expect(createCall.phoneNumber).toBe("+1234567890");
    });

    it("should handle undefined phoneNumber when email is provided", async () => {
      await inviteService.createInvite({
        email: "user@example.com",
        phoneNumber: undefined,
        roleId: "role-123",
        invitedByUserId: "admin-456",
      });

      const createCall = (mockInviteRepository.create as any).mock.calls[0][0];
      expect(createCall.email).toBe("user@example.com");
      expect(createCall.phoneNumber).toBeUndefined();
    });

    it("should allow both email and phoneNumber", async () => {
      await inviteService.createInvite({
        email: "user@example.com",
        phoneNumber: "+1234567890",
        roleId: "role-123",
        invitedByUserId: "admin-456",
      });

      const createCall = (mockInviteRepository.create as any).mock.calls[0][0];
      expect(createCall.email).toBe("user@example.com");
      expect(createCall.phoneNumber).toBe("+1234567890");
    });
  });
});
