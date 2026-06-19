import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { prisma } from "../../../../../infrastructure/database/prisma.client";
import { PrismaInviteRepository } from "./prisma-invite.repository";
import { getUniqueTestId } from "../../../../../test-utils/database-helpers";

describe("PrismaInviteRepository (Integration)", () => {
  let inviteRepository: PrismaInviteRepository;
  let testRoleId: string;
  let testInviterId: string;

  beforeAll(async () => {
    // Use existing seeded role
    const testRole = await prisma.role.findUnique({
      where: { name: "USER" },
    });
    
    if (!testRole) {
      throw new Error("USER role not found in seeded database");
    }
    
    testRoleId = testRole.id;

    // Create a test inviter user
    const uniqueId = getUniqueTestId();
    const inviter = await prisma.user.create({
      data: {
        email: `inviter_${uniqueId}@example.com`,
        username: `inviter_${uniqueId}`,
        passwordHash: "$argon2id$test",
        roleId: testRoleId,
        status: "ACTIVE",
      },
    });
    testInviterId = inviter.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.invitation.deleteMany({ where: { invitedByUserId: testInviterId } });
    await prisma.user.delete({ where: { id: testInviterId } }).catch(() => {});
  });

  beforeEach(async () => {
    await prisma.invitation.deleteMany({ where: { invitedByUserId: testInviterId } });
    inviteRepository = new PrismaInviteRepository();
  });

  describe("create", () => {
    it("should create invite with email", async () => {
      const invite = await inviteRepository.create({
        email: "newuser@example.com",
        tokenHash: "hashed-token",
        roleId: testRoleId,
        invitedByUserId: testInviterId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      expect(invite).toBeDefined();
      expect(invite.email).toBe("newuser@example.com");
      expect(invite.phoneNumber).toBeNull();
    });

    it("should create invite with phone number", async () => {
      const invite = await inviteRepository.create({
        phoneNumber: "+1234567890",
        tokenHash: "hashed-token",
        roleId: testRoleId,
        invitedByUserId: testInviterId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      expect(invite.phoneNumber).toBe("+1234567890");
      expect(invite.email).toBeNull();
    });

    it("should include role in created invite", async () => {
      const invite = await inviteRepository.create({
        email: "newuser@example.com",
        tokenHash: "hashed-token",
        roleId: testRoleId,
        invitedByUserId: testInviterId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      expect(invite.role).toBeDefined();
      expect(invite.role.id).toBe(testRoleId);
    });

    it("should set status to PENDING by default", async () => {
      const invite = await inviteRepository.create({
        email: "newuser@example.com",
        tokenHash: "hashed-token",
        roleId: testRoleId,
        invitedByUserId: testInviterId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      expect(invite.status).toBe("PENDING");
    });

    it("should set expiresAt correctly", async () => {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const invite = await inviteRepository.create({
        email: "newuser@example.com",
        tokenHash: "hashed-token",
        roleId: testRoleId,
        invitedByUserId: testInviterId,
        expiresAt,
      });

      expect(invite.expiresAt.getTime()).toBeCloseTo(expiresAt.getTime(), -3);
    });

    it("should set acceptedAt to null", async () => {
      const invite = await inviteRepository.create({
        email: "newuser@example.com",
        tokenHash: "hashed-token",
        roleId: testRoleId,
        invitedByUserId: testInviterId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      expect(invite.acceptedAt).toBeNull();
    });

    it("should set revokedAt to null", async () => {
      const invite = await inviteRepository.create({
        email: "newuser@example.com",
        tokenHash: "hashed-token",
        roleId: testRoleId,
        invitedByUserId: testInviterId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      expect(invite.revokedAt).toBeNull();
    });
  });

  describe("findValidByTokenHash", () => {
    it("should find valid pending invite", async () => {
      const tokenHash = "hashed-token-123";

      await inviteRepository.create({
        email: "newuser@example.com",
        tokenHash,
        roleId: testRoleId,
        invitedByUserId: testInviterId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const invite = await inviteRepository.findValidByTokenHash(tokenHash);

      expect(invite).not.toBeNull();
      expect(invite?.tokenHash).toBe(tokenHash);
    });

    it("should include role in found invite", async () => {
      const tokenHash = "hashed-token-456";

      await inviteRepository.create({
        email: "newuser@example.com",
        tokenHash,
        roleId: testRoleId,
        invitedByUserId: testInviterId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const invite = await inviteRepository.findValidByTokenHash(tokenHash);

      expect(invite?.role).toBeDefined();
      expect(invite?.role.id).toBe(testRoleId);
    });

    it("should exclude revoked invites", async () => {
      const tokenHash = "hashed-token-revoked";

      const created = await inviteRepository.create({
        email: "newuser@example.com",
        tokenHash,
        roleId: testRoleId,
        invitedByUserId: testInviterId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      await inviteRepository.revoke(created.id);

      const invite = await inviteRepository.findValidByTokenHash(tokenHash);

      expect(invite).toBeNull();
    });

    it("should exclude expired invites", async () => {
      const tokenHash = "hashed-token-expired";

      await inviteRepository.create({
        email: "newuser@example.com",
        tokenHash,
        roleId: testRoleId,
        invitedByUserId: testInviterId,
        expiresAt: new Date(Date.now() - 1000),
      });

      const invite = await inviteRepository.findValidByTokenHash(tokenHash);

      expect(invite).toBeNull();
    });

    it("should exclude accepted invites", async () => {
      const tokenHash = "hashed-token-accepted";

      const created = await inviteRepository.create({
        email: "accepted-test@example.com",
        tokenHash,
        roleId: testRoleId,
        invitedByUserId: testInviterId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const user = await prisma.user.create({
        data: {
          email: "accepted-test@example.com",
          username: `accepteduser1_${Date.now()}`,
          passwordHash: "$argon2id$test",
          roleId: testRoleId,
          status: "ACTIVE",
        },
      });

      await inviteRepository.markAccepted(created.id, user.id);

      const invite = await inviteRepository.findValidByTokenHash(tokenHash);

      expect(invite).toBeNull();
    });

    it("should return null when token not found", async () => {
      const invite = await inviteRepository.findValidByTokenHash(
        "non-existent-token"
      );

      expect(invite).toBeNull();
    });
  });

  describe("findById", () => {
    it("should find invite by ID", async () => {
      const created = await inviteRepository.create({
        email: "newuser@example.com",
        tokenHash: "hashed-token",
        roleId: testRoleId,
        invitedByUserId: testInviterId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const invite = await inviteRepository.findById(created.id);

      expect(invite).not.toBeNull();
      expect(invite?.id).toBe(created.id);
    });

    it("should include role in found invite", async () => {
      const created = await inviteRepository.create({
        email: "newuser@example.com",
        tokenHash: "hashed-token",
        roleId: testRoleId,
        invitedByUserId: testInviterId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const invite = await inviteRepository.findById(created.id);

      expect(invite?.role).toBeDefined();
      expect(invite?.role.id).toBe(testRoleId);
    });

    it("should return null when invite not found", async () => {
      const invite = await inviteRepository.findById("non-existent-id");

      expect(invite).toBeNull();
    });
  });

  describe("findByEmailOrPhone", () => {
    it("should find invite by email", async () => {
      await inviteRepository.create({
        email: "search@example.com",
        tokenHash: "hashed-token",
        roleId: testRoleId,
        invitedByUserId: testInviterId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const invite = await inviteRepository.findByEmailOrPhone(
        "search@example.com",
        undefined
      );

      expect(invite).not.toBeNull();
      expect(invite?.email).toBe("search@example.com");
    });

    it("should find invite by phone number", async () => {
      await inviteRepository.create({
        phoneNumber: "+1234567890",
        tokenHash: "hashed-token",
        roleId: testRoleId,
        invitedByUserId: testInviterId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const invite = await inviteRepository.findByEmailOrPhone(
        undefined,
        "+1234567890"
      );

      expect(invite).not.toBeNull();
      expect(invite?.phoneNumber).toBe("+1234567890");
    });

    it("should only find PENDING invites", async () => {
      const created = await inviteRepository.create({
        email: "revoked@example.com",
        tokenHash: "hashed-token",
        roleId: testRoleId,
        invitedByUserId: testInviterId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      await inviteRepository.revoke(created.id);

      const invite = await inviteRepository.findByEmailOrPhone(
        "revoked@example.com",
        undefined
      );

      expect(invite).toBeNull();
    });

    it("should return null when neither email nor phone provided", async () => {
      const invite = await inviteRepository.findByEmailOrPhone(undefined, undefined);

      expect(invite).toBeNull();
    });

    it("should return null when not found", async () => {
      const invite = await inviteRepository.findByEmailOrPhone(
        "notfound@example.com",
        undefined
      );

      expect(invite).toBeNull();
    });
  });

  describe("markAccepted", () => {
    it("should mark invite as accepted", async () => {
      const invite = await inviteRepository.create({
        email: "acceptuser@example.com",
        tokenHash: "hashed-token-accept",
        roleId: testRoleId,
        invitedByUserId: testInviterId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const user = await prisma.user.create({
        data: {
          email: "acceptuser@example.com",
          username: `accepteduser_${Date.now()}`,
          passwordHash: "$argon2id$test",
          roleId: testRoleId,
          status: "ACTIVE",
        },
      });

      await inviteRepository.markAccepted(invite.id, user.id);

      const updated = await inviteRepository.findById(invite.id);

      expect(updated?.status).toBe("ACCEPTED");
      expect(updated?.acceptedAt).toBeInstanceOf(Date);
    });
  });

  describe("revoke", () => {
    it("should revoke invite", async () => {
      const invite = await inviteRepository.create({
        email: "newuser@example.com",
        tokenHash: "hashed-token",
        roleId: testRoleId,
        invitedByUserId: testInviterId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      await inviteRepository.revoke(invite.id);

      const updated = await inviteRepository.findById(invite.id);

      expect(updated?.status).toBe("REVOKED");
      expect(updated?.revokedAt).toBeInstanceOf(Date);
    });

    it("should set revokedAt timestamp", async () => {
      const invite = await inviteRepository.create({
        email: "newuser@example.com",
        tokenHash: "hashed-token",
        roleId: testRoleId,
        invitedByUserId: testInviterId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const before = Date.now();
      await inviteRepository.revoke(invite.id);
      const after = Date.now();

      const updated = await inviteRepository.findById(invite.id);

      expect(updated?.revokedAt).toBeInstanceOf(Date);
      expect(updated?.revokedAt!.getTime()).toBeGreaterThanOrEqual(before);
      expect(updated?.revokedAt!.getTime()).toBeLessThanOrEqual(after);
    });
  });
});
