import { beforeEach, describe, expect, it, mock } from "bun:test";

import type { PrismaClient } from "@atlasmed/database";

import { PrismaPasswordResetRepository } from "./prisma-password-reset.repository";

describe("PrismaPasswordResetRepository", () => {
  let repository: PrismaPasswordResetRepository;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      passwordReset: {
        create: mock(() => Promise.resolve({})),
        findUnique: mock(() => Promise.resolve(null)),
        update: mock(() => Promise.resolve({})),
        deleteMany: mock(() => Promise.resolve({ count: 0 })),
      },
    } as unknown as PrismaClient;

    repository = new PrismaPasswordResetRepository({ prisma: mockPrisma });
  });

  describe("create", () => {
    it("should create a password reset record", async () => {
      const params = {
        userId: "user-123",
        tokenHash: "hash-123",
        expiresAt: new Date("2026-05-22"),
      };

      const mockPasswordReset = {
        id: "reset-123",
        ...params,
        usedAt: null,
        userAgent: null,
        ipAddress: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.passwordReset.create.mockResolvedValue(mockPasswordReset);

      const result = await repository.create(params);

      expect(mockPrisma.passwordReset.create).toHaveBeenCalledWith({
        data: params,
      });
      expect(result).toEqual(mockPasswordReset);
    });
  });

  describe("findByToken", () => {
    it("should find a password reset by token hash", async () => {
      const tokenHash = "hash-123";
      const mockPasswordReset = {
        id: "reset-123",
        userId: "user-123",
        tokenHash,
        expiresAt: new Date("2026-05-22"),
        usedAt: null,
        user: { id: "user-123", email: "user@example.com" },
      };

      mockPrisma.passwordReset.findUnique.mockResolvedValue(mockPasswordReset);

      const result = await repository.findByToken({ tokenHash });

      expect(mockPrisma.passwordReset.findUnique).toHaveBeenCalledWith({
        where: { tokenHash },
        include: { user: true },
      });
      expect(result).toEqual(mockPasswordReset as any);
    });

    it("should return null if token not found", async () => {
      mockPrisma.passwordReset.findUnique.mockResolvedValue(null);

      const result = await repository.findByToken({ tokenHash: "nonexistent" });

      expect(result).toBeNull();
    });
  });

  describe("markAsUsed", () => {
    it("should mark a password reset as used", async () => {
      const id = "reset-123";
      const usedAt = new Date();

      await repository.markAsUsed(id);

      expect(mockPrisma.passwordReset.update).toHaveBeenCalledWith({
        where: { id },
        data: { usedAt: expect.any(Date) },
      });
    });
  });

  describe("deleteExpired", () => {
    it("should delete expired password reset records", async () => {
      mockPrisma.passwordReset.deleteMany.mockResolvedValue({ count: 5 });

      await repository.deleteExpired();

      expect(mockPrisma.passwordReset.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: {
            lt: expect.any(Date),
          },
        },
      });
    });
  });
});
