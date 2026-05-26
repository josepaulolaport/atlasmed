import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { prisma } from "../../../../../infrastructure/database/prisma.client";
import { PrismaSessionRepository } from "./prisma-session.repository";
import { hashToken } from "../../../../../shared/utils/hash-token";
import { randomUUID } from "node:crypto";
import { cleanTestData, getUniqueTestId } from "../../../../../test-utils/database-helpers";

describe("PrismaSessionRepository (Integration)", () => {
  let sessionRepository: PrismaSessionRepository;
  let testUserId: string;
  let testRoleId: string;

  beforeAll(async () => {
    // Use existing seeded role
    const testRole = await prisma.role.findUnique({
      where: { name: "USER" },
    });
    
    if (!testRole) {
      throw new Error("USER role not found in seeded database");
    }
    
    testRoleId = testRole.id;

    // Create a test user for session tests
    const uniqueId = getUniqueTestId();
    const testUser = await prisma.user.create({
      data: {
        email: `session_${uniqueId}@example.com`,
        username: `session_${uniqueId}`,
        passwordHash: "$argon2id$test",
        roleId: testRoleId,
        status: "ACTIVE",
      },
    });
    testUserId = testUser.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.session.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
  });

  beforeEach(async () => {
    await prisma.session.deleteMany({ where: { userId: testUserId } });
    sessionRepository = new PrismaSessionRepository();
  });

  describe("create", () => {
    it("should create session", async () => {
      const session = await sessionRepository.create({
        id: randomUUID(),
        userId: testUserId,
        refreshTokenHash: "hashed-token",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      expect(session).toBeDefined();
      expect(session.userId).toBe(testUserId);
      expect(session.refreshTokenHash).toBe("hashed-token");
    });

    it("should create session with ipAddress", async () => {
      const session = await sessionRepository.create({
        id: randomUUID(),
        userId: testUserId,
        refreshTokenHash: "hashed-token",
        ipAddress: "192.168.1.1",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      expect(session.ipAddress).toBe("192.168.1.1");
    });

    it("should create session with userAgent", async () => {
      const session = await sessionRepository.create({
        id: randomUUID(),
        userId: testUserId,
        refreshTokenHash: "hashed-token",
        userAgent: "Mozilla/5.0",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      expect(session.userAgent).toBe("Mozilla/5.0");
    });

    it("should set expiresAt correctly", async () => {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const session = await sessionRepository.create({
        id: randomUUID(),
        userId: testUserId,
        refreshTokenHash: "hashed-token",
        expiresAt,
      });

      expect(session.expiresAt.getTime()).toBeCloseTo(expiresAt.getTime(), -3);
    });

    it("should set revokedAt to null by default", async () => {
      const session = await sessionRepository.create({
        id: randomUUID(),
        userId: testUserId,
        refreshTokenHash: "hashed-token",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      expect(session.revokedAt).toBeNull();
    });
  });

  describe("findActiveByTokenHash", () => {
    it("should find active session by token hash", async () => {
      const tokenHash = "hashed-token-123";

      await sessionRepository.create({
        id: randomUUID(),
        userId: testUserId,
        refreshTokenHash: tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const session = await sessionRepository.findActiveByTokenHash(tokenHash);

      expect(session).not.toBeNull();
      expect(session?.refreshTokenHash).toBe(tokenHash);
    });

    it("should include user with role", async () => {
      const tokenHash = "hashed-token-456";

      await sessionRepository.create({
        id: randomUUID(),
        userId: testUserId,
        refreshTokenHash: tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const session = await sessionRepository.findActiveByTokenHash(tokenHash);

      expect(session?.user).toBeDefined();
      expect(session?.user.role).toBeDefined();
      expect(session?.user.id).toBe(testUserId);
    });

    it("should exclude revoked sessions", async () => {
      const tokenHash = "hashed-token-revoked";

      const created = await sessionRepository.create({
        id: randomUUID(),
        userId: testUserId,
        refreshTokenHash: tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      await sessionRepository.revoke(created.id);

      const session = await sessionRepository.findActiveByTokenHash(tokenHash);

      expect(session).toBeNull();
    });

    it("should exclude expired sessions", async () => {
      const tokenHash = "hashed-token-expired";

      await sessionRepository.create({
        id: randomUUID(),
        userId: testUserId,
        refreshTokenHash: tokenHash,
        expiresAt: new Date(Date.now() - 1000),
      });

      const session = await sessionRepository.findActiveByTokenHash(tokenHash);

      expect(session).toBeNull();
    });

    it("should return null when token not found", async () => {
      const session = await sessionRepository.findActiveByTokenHash(
        "non-existent-token"
      );

      expect(session).toBeNull();
    });
  });

  describe("findById", () => {
    it("should find session by ID", async () => {
      const sessionId = randomUUID();

      await sessionRepository.create({
        id: sessionId,
        userId: testUserId,
        refreshTokenHash: "hashed-token",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const session = await sessionRepository.findById(sessionId);

      expect(session).not.toBeNull();
      expect(session?.id).toBe(sessionId);
    });

    it("should include user with role", async () => {
      const sessionId = randomUUID();

      await sessionRepository.create({
        id: sessionId,
        userId: testUserId,
        refreshTokenHash: "hashed-token",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const session = await sessionRepository.findById(sessionId);

      expect(session?.user).toBeDefined();
      expect(session?.user.role).toBeDefined();
    });

    it("should return null when session not found", async () => {
      const session = await sessionRepository.findById("non-existent-id");

      expect(session).toBeNull();
    });
  });

  describe("findSessionStatus", () => {
    it("should return session status fields only", async () => {
      const sessionId = randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await sessionRepository.create({
        id: sessionId,
        userId: testUserId,
        refreshTokenHash: "hashed-token",
        expiresAt,
      });

      const status = await sessionRepository.findSessionStatus(sessionId);

      expect(status).toEqual({
        userId: testUserId,
        revokedAt: null,
        expiresAt,
      });
    });

    it("should reflect revoked session status", async () => {
      const sessionId = randomUUID();

      const created = await sessionRepository.create({
        id: sessionId,
        userId: testUserId,
        refreshTokenHash: "hashed-token",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      await sessionRepository.revoke(created.id);

      const status = await sessionRepository.findSessionStatus(sessionId);

      expect(status?.userId).toBe(testUserId);
      expect(status?.revokedAt).toBeInstanceOf(Date);
    });

    it("should return null when session not found", async () => {
      const status = await sessionRepository.findSessionStatus("non-existent-id");

      expect(status).toBeNull();
    });
  });

  describe("findByUserId", () => {
    it("should find active sessions for distinct devices", async () => {
      await sessionRepository.create({
        id: randomUUID(),
        userId: testUserId,
        refreshTokenHash: "token-1",
        deviceFingerprint: "device-a",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      await sessionRepository.create({
        id: randomUUID(),
        userId: testUserId,
        refreshTokenHash: "token-2",
        deviceFingerprint: "device-b",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const sessions = await sessionRepository.findByUserId(testUserId);

      expect(sessions).toHaveLength(2);
    });

    it("should return only the most recent session per device fingerprint", async () => {
      const olderSession = await sessionRepository.create({
        id: randomUUID(),
        userId: testUserId,
        refreshTokenHash: "token-older",
        deviceFingerprint: "shared-device",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const newerSession = await sessionRepository.create({
        id: randomUUID(),
        userId: testUserId,
        refreshTokenHash: "token-newer",
        deviceFingerprint: "shared-device",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const sessions = await sessionRepository.findByUserId(testUserId);

      expect(sessions).toHaveLength(1);
      expect(sessions[0]!.id).toBe(newerSession.id);
      expect(sessions[0]!.id).not.toBe(olderSession.id);
    });

    it("should exclude revoked sessions", async () => {
      const session1 = await sessionRepository.create({
        id: randomUUID(),
        userId: testUserId,
        refreshTokenHash: "token-1",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      await sessionRepository.create({
        id: randomUUID(),
        userId: testUserId,
        refreshTokenHash: "token-2",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      await sessionRepository.revoke(session1.id);

      const sessions = await sessionRepository.findByUserId(testUserId);

      expect(sessions).toHaveLength(1);
    });

    it("should exclude expired sessions", async () => {
      await sessionRepository.create({
        id: randomUUID(),
        userId: testUserId,
        refreshTokenHash: "token-expired",
        expiresAt: new Date(Date.now() - 1000),
      });

      await sessionRepository.create({
        id: randomUUID(),
        userId: testUserId,
        refreshTokenHash: "token-active",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const sessions = await sessionRepository.findByUserId(testUserId);

      expect(sessions).toHaveLength(1);
    });

    it("should order sessions by most recently seen first", async () => {
      const session1 = await sessionRepository.create({
        id: randomUUID(),
        userId: testUserId,
        refreshTokenHash: "token-1",
        deviceFingerprint: "device-a",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const session2 = await sessionRepository.create({
        id: randomUUID(),
        userId: testUserId,
        refreshTokenHash: "token-2",
        deviceFingerprint: "device-b",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const sessions = await sessionRepository.findByUserId(testUserId);

      expect(sessions[0]!.id).toBe(session2.id);
      expect(sessions[1]!.id).toBe(session1.id);
    });

    it("should return empty array when no active sessions", async () => {
      const sessions = await sessionRepository.findByUserId(testUserId);

      expect(sessions).toEqual([]);
    });
  });

  describe("revoke", () => {
    it("should revoke session", async () => {
      const session = await sessionRepository.create({
        id: randomUUID(),
        userId: testUserId,
        refreshTokenHash: "hashed-token",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      await sessionRepository.revoke(session.id);

      const updated = await sessionRepository.findById(session.id);

      expect(updated?.revokedAt).toBeInstanceOf(Date);
    });

    it("should set revokedAt timestamp", async () => {
      const session = await sessionRepository.create({
        id: randomUUID(),
        userId: testUserId,
        refreshTokenHash: "hashed-token",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const before = Date.now();
      await sessionRepository.revoke(session.id);
      const after = Date.now();

      const updated = await sessionRepository.findById(session.id);

      expect(updated?.revokedAt).toBeInstanceOf(Date);
      expect(updated?.revokedAt!.getTime()).toBeGreaterThanOrEqual(before);
      expect(updated?.revokedAt!.getTime()).toBeLessThanOrEqual(after);
    });
  });

  describe("revokeAllByUserId", () => {
    it("should revoke all sessions for user", async () => {
      const session1 = await sessionRepository.create({
        id: randomUUID(),
        userId: testUserId,
        refreshTokenHash: "token-1",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const session2 = await sessionRepository.create({
        id: randomUUID(),
        userId: testUserId,
        refreshTokenHash: "token-2",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      await sessionRepository.revokeAllByUserId(testUserId);

      const sessions = await sessionRepository.findByUserId(testUserId);

      expect(sessions).toHaveLength(0);
    });

    it("should exclude specific session when excludeSessionId provided", async () => {
      const session1 = await sessionRepository.create({
        id: randomUUID(),
        userId: testUserId,
        refreshTokenHash: "token-1",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const session2 = await sessionRepository.create({
        id: randomUUID(),
        userId: testUserId,
        refreshTokenHash: "token-2",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      await sessionRepository.revokeAllByUserId(testUserId, session2.id);

      const sessions = await sessionRepository.findByUserId(testUserId);

      expect(sessions).toHaveLength(1);
      expect(sessions[0]!.id).toBe(session2.id);
    });

    it("should set revoked reason", async () => {
      const session = await sessionRepository.create({
        id: randomUUID(),
        userId: testUserId,
        refreshTokenHash: "token-1",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      await sessionRepository.revokeAllByUserId(testUserId);

      const updated = await prisma.session.findUnique({
        where: { id: session.id },
      });

      expect(updated?.revokedReason).toBe("User deactivation or logout all");
    });
  });

  describe("updateLastSeen", () => {
    it("should update last seen timestamp", async () => {
      const session = await sessionRepository.create({
        id: randomUUID(),
        userId: testUserId,
        refreshTokenHash: "hashed-token",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const before = session.lastSeenAt;

      await new Promise((resolve) => setTimeout(resolve, 10));

      await sessionRepository.updateLastSeen(session.id);

      const updated = await sessionRepository.findById(session.id);

      expect(updated?.lastSeenAt).not.toEqual(before);
      expect(updated?.lastSeenAt).toBeInstanceOf(Date);
    });
  });
});
