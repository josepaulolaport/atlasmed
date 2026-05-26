import { beforeEach, afterEach, describe, expect, it, mock } from "bun:test";
import { SessionService } from "./session.service";
import type { SessionRepository } from "../interfaces/session.repository.interface";
import type { ISessionCache } from "../interfaces/session-cache.interface";
import { createMockSessionRepository, createMockSessionCache } from "../../test-helpers/fixtures";
import { hashToken } from "../../../../shared/utils/hash-token";
import { resetAllMocks } from "../../../../test-utils/mock-reset";

describe("SessionService", () => {
  let sessionService: SessionService;
  let mockSessionRepository: SessionRepository;
  let mockSessionCache: ISessionCache;

  beforeEach(() => {
    mock.restore();

    mockSessionRepository = createMockSessionRepository({
      createLoginSessionTransaction: mock(async (params) => ({
        session: {
          id: params.id,
          userId: params.userId,
          refreshTokenHash: params.refreshTokenHash,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          expiresAt: params.expiresAt,
          createdAt: new Date(),
          lastSeenAt: new Date(),
          revokedAt: null,
          revokedReason: null,
        },
        revokedSessionIds: [],
      })),
    });

    mockSessionCache = createMockSessionCache();

    sessionService = new SessionService({
      sessionRepository: mockSessionRepository,
      sessionCache: mockSessionCache,
    });
  });

  afterEach(() => {
    resetAllMocks(mockSessionRepository, mockSessionCache);
    mock.restore();
  });

  describe("create", () => {
    it("should create a session with userId", async () => {
      const userId = "user-123";

      await sessionService.create({ userId, userRole: "USER" });

      expect(mockSessionRepository.createLoginSessionTransaction).toHaveBeenCalledTimes(1);
      const createCall = (mockSessionRepository.createLoginSessionTransaction as any).mock
        .calls[0][0];
      expect(createCall.userId).toBe(userId);
    });

    it("should call createLoginSessionTransaction once per login", async () => {
      await sessionService.create({ userId: "user-123", userRole: "USER" });

      expect(mockSessionRepository.createLoginSessionTransaction).toHaveBeenCalledTimes(1);
      expect(mockSessionRepository.revokeAllActiveForDevice).not.toHaveBeenCalled();
      expect(mockSessionRepository.create).not.toHaveBeenCalled();
    });

    it("should invalidate cache for revoked session IDs", async () => {
      mockSessionRepository.createLoginSessionTransaction = mock(async (params) => ({
        session: {
          id: params.id,
          userId: params.userId,
          refreshTokenHash: params.refreshTokenHash,
          expiresAt: params.expiresAt,
          createdAt: new Date(),
          lastSeenAt: new Date(),
          revokedAt: null,
        },
        revokedSessionIds: ["old-session-1", "old-session-2"],
      }));

      await sessionService.create({ userId: "user-123", userRole: "USER" });

      expect(mockSessionCache.invalidate).toHaveBeenCalledTimes(2);
      expect(mockSessionCache.invalidate).toHaveBeenCalledWith("old-session-1");
      expect(mockSessionCache.invalidate).toHaveBeenCalledWith("old-session-2");
    });

    it("should set cache for the new session", async () => {
      await sessionService.create({ userId: "user-123", userRole: "USER" });

      expect(mockSessionCache.set).toHaveBeenCalledTimes(1);
      const setCall = (mockSessionCache.set as any).mock.calls[0][0];
      expect(setCall.userId).toBe("user-123");
      expect(setCall.revokedAt).toBeNull();
    });

    it("should generate a refresh token", async () => {
      const result = await sessionService.create({ userId: "user-123", userRole: "USER" });

      expect(result.refreshToken).toBeString();
      expect(result.refreshToken.length).toBeGreaterThan(0);
    });

    it("should store HASHED refresh token only", async () => {
      const result = await sessionService.create({ userId: "user-123", userRole: "USER" });

      const createCall = (mockSessionRepository.createLoginSessionTransaction as any).mock
        .calls[0][0];
      expect(createCall.refreshTokenHash).not.toBe(result.refreshToken);
      expect(createCall.refreshTokenHash).toBe(hashToken(result.refreshToken));
    });

    it("should set expiration to 24 hours (USER role)", async () => {
      const beforeCreate = Date.now();
      await sessionService.create({ userId: "user-123", userRole: "USER" });
      const afterCreate = Date.now();

      const createCall = (mockSessionRepository.createLoginSessionTransaction as any).mock
        .calls[0][0];
      const expiresAt = createCall.expiresAt.getTime();

      const expectedMin = beforeCreate + 24 * 60 * 60 * 1000;
      const expectedMax = afterCreate + 24 * 60 * 60 * 1000;

      expect(expiresAt).toBeGreaterThanOrEqual(expectedMin);
      expect(expiresAt).toBeLessThanOrEqual(expectedMax);
    });

    it("should include ipAddress when provided", async () => {
      const ipAddress = "192.168.1.1";

      await sessionService.create({
        userId: "user-123",
        userRole: "USER",
        ipAddress,
      });

      const createCall = (mockSessionRepository.createLoginSessionTransaction as any).mock
        .calls[0][0];
      expect(createCall.ipAddress).toBe(ipAddress);
    });

    it("should include userAgent when provided", async () => {
      const userAgent = "Mozilla/5.0";

      await sessionService.create({
        userId: "user-123",
        userRole: "USER",
        userAgent,
      });

      const createCall = (mockSessionRepository.createLoginSessionTransaction as any).mock
        .calls[0][0];
      expect(createCall.userAgent).toBe(userAgent);
    });

    it("should handle undefined ipAddress", async () => {
      await sessionService.create({
        userId: "user-123",
        userRole: "USER",
        ipAddress: undefined,
      });

      const createCall = (mockSessionRepository.createLoginSessionTransaction as any).mock
        .calls[0][0];
      expect(createCall.ipAddress).toBeUndefined();
    });

    it("should handle undefined userAgent", async () => {
      await sessionService.create({
        userId: "user-123",
        userRole: "USER",
        userAgent: undefined,
      });

      const createCall = (mockSessionRepository.createLoginSessionTransaction as any).mock
        .calls[0][0];
      expect(createCall.userAgent).toBeUndefined();
    });

    it("should generate unique session IDs", async () => {
      const result1 = await sessionService.create({ userId: "user-123", userRole: "USER" });
      const result2 = await sessionService.create({ userId: "user-123", userRole: "USER" });

      expect(result1.id).not.toBe(result2.id);
    });

    it("should generate unique refresh tokens", async () => {
      const result1 = await sessionService.create({ userId: "user-123", userRole: "USER" });
      const result2 = await sessionService.create({ userId: "user-123", userRole: "USER" });

      expect(result1.refreshToken).not.toBe(result2.refreshToken);
    });

    it("should return session with refresh token", async () => {
      const result = await sessionService.create({ userId: "user-123", userRole: "USER" });

      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("userId");
      expect(result).toHaveProperty("refreshToken");
      expect(result).toHaveProperty("refreshTokenHash");
      expect(result).toHaveProperty("expiresAt");
    });

    it("should handle empty string ipAddress", async () => {
      await sessionService.create({
        userId: "user-123",
        userRole: "USER",
        ipAddress: "",
      });

      const createCall = (mockSessionRepository.createLoginSessionTransaction as any).mock
        .calls[0][0];
      expect(createCall.ipAddress).toBeUndefined();
    });

    it("should handle empty string userAgent", async () => {
      await sessionService.create({
        userId: "user-123",
        userRole: "USER",
        userAgent: "",
      });

      const createCall = (mockSessionRepository.createLoginSessionTransaction as any).mock
        .calls[0][0];
      expect(createCall.userAgent).toBeUndefined();
    });
  });

  describe("revoke", () => {
    it("should revoke a session by ID", async () => {
      const sessionId = "session-123";

      await sessionService.revoke(sessionId);

      expect(mockSessionRepository.revoke).toHaveBeenCalledTimes(1);
      expect(mockSessionRepository.revoke).toHaveBeenCalledWith(sessionId);
    });

    it("should call repository revoke method", async () => {
      const sessionId = "session-abc";

      await sessionService.revoke(sessionId);

      expect(mockSessionRepository.revoke).toHaveBeenCalledWith(sessionId);
    });
  });
});
