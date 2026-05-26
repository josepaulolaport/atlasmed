import { beforeEach, describe, expect, it, mock } from "bun:test";

import type { PrismaClient } from "@atlasmed/database";

import { PrismaVerificationTokenRepository } from "./prisma-verification-token.repository";

describe("PrismaVerificationTokenRepository", () => {
  let repository: PrismaVerificationTokenRepository;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      verificationToken: {
        deleteMany: mock(() => Promise.resolve({ count: 0 })),
        create: mock(() => Promise.resolve({})),
        findFirst: mock(() => Promise.resolve(null)),
        update: mock(() => Promise.resolve({})),
      },
    } as unknown as PrismaClient;

    repository = new PrismaVerificationTokenRepository({ prisma: mockPrisma });
  });

  describe("deleteUnusedByUserAndType", () => {
    it("should delete unverified tokens for user and type", async () => {
      await repository.deleteUnusedByUserAndType("user-123", "EMAIL_VERIFICATION");

      expect(mockPrisma.verificationToken.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: "user-123",
          type: "EMAIL_VERIFICATION",
          verifiedAt: null,
        },
      });
    });
  });

  describe("create", () => {
    it("should create a verification token record", async () => {
      const params = {
        userId: "user-123",
        type: "EMAIL_VERIFICATION" as const,
        tokenHash: "hash-123",
        newValue: "new@example.com",
        expiresAt: new Date("2026-05-27"),
      };

      await repository.create(params);

      expect(mockPrisma.verificationToken.create).toHaveBeenCalledWith({
        data: params,
      });
    });
  });

  describe("findValidToken", () => {
    it("should find a valid unverified token", async () => {
      const mockToken = {
        id: "token-123",
        newValue: null,
      };

      mockPrisma.verificationToken.findFirst.mockResolvedValue(mockToken);

      const result = await repository.findValidToken({
        tokenHash: "hash-123",
        userId: "user-123",
        type: "EMAIL_VERIFICATION",
      });

      expect(mockPrisma.verificationToken.findFirst).toHaveBeenCalledWith({
        where: {
          tokenHash: "hash-123",
          userId: "user-123",
          type: "EMAIL_VERIFICATION",
          verifiedAt: null,
          expiresAt: { gt: expect.any(Date) },
        },
        select: {
          id: true,
          newValue: true,
        },
      });
      expect(result).toEqual(mockToken);
    });

    it("should return null if token not found", async () => {
      mockPrisma.verificationToken.findFirst.mockResolvedValue(null);

      const result = await repository.findValidToken({
        tokenHash: "nonexistent",
        userId: "user-123",
        type: "EMAIL_VERIFICATION",
      });

      expect(result).toBeNull();
    });
  });

  describe("markVerified", () => {
    it("should mark a verification token as verified", async () => {
      await repository.markVerified("token-123");

      expect(mockPrisma.verificationToken.update).toHaveBeenCalledWith({
        where: { id: "token-123" },
        data: { verifiedAt: expect.any(Date) },
      });
    });
  });
});
