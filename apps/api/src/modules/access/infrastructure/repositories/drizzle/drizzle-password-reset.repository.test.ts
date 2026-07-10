import { beforeEach, describe, expect, it, mock } from "bun:test";

import { DrizzlePasswordResetRepository } from "./drizzle-password-reset.repository";

// Track the last arguments passed to each db operation for assertions
let lastInsertedValues: any;
let lastUpdateSet: any;
let lastUpdateWhereExpr: any;
let lastDeleteWhereExpr: any;
let mockSelectResult: any = null;

const mockReturning = mock(() => Promise.resolve([{ id: "reset-123", usedAt: null }]));
const mockValues = mock((vals: any) => {
  lastInsertedValues = vals;
  return { returning: mockReturning };
});
const mockInsert = mock(() => ({ values: mockValues }));

const mockLimit = mock(() =>
  Promise.resolve(mockSelectResult !== null ? [mockSelectResult] : [])
);
const mockSelectWhere = mock(() => ({ limit: mockLimit }));
const mockFromInner = mock(() => ({ where: mockSelectWhere }));
const mockSelect = mock(() => ({ from: mockFromInner }));

const mockUpdateWhere = mock((expr: any) => {
  lastUpdateWhereExpr = expr;
  return Promise.resolve();
});
const mockSet = mock((setData: any) => {
  lastUpdateSet = setData;
  return { where: mockUpdateWhere };
});
const mockUpdate = mock(() => ({ set: mockSet }));

const mockDeleteWhere = mock((expr: any) => {
  lastDeleteWhereExpr = expr;
  return Promise.resolve();
});
const mockDelete = mock(() => ({ where: mockDeleteWhere }));

mock.module("../../../../../infrastructure/database/db", () => ({
  db: {
    insert: mockInsert,
    select: mockSelect,
    update: mockUpdate,
    delete: mockDelete,
  },
}));

describe("DrizzlePasswordResetRepository", () => {
  let repository: DrizzlePasswordResetRepository;

  beforeEach(() => {
    lastInsertedValues = undefined;
    lastUpdateSet = undefined;
    lastUpdateWhereExpr = undefined;
    lastDeleteWhereExpr = undefined;
    mockSelectResult = null;
    mockReturning.mockClear();
    mockValues.mockClear();
    mockInsert.mockClear();
    mockLimit.mockClear();
    mockSelectWhere.mockClear();
    mockFromInner.mockClear();
    mockSelect.mockClear();
    mockUpdateWhere.mockClear();
    mockSet.mockClear();
    mockUpdate.mockClear();
    mockDeleteWhere.mockClear();
    mockDelete.mockClear();

    repository = new DrizzlePasswordResetRepository();
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

      mockReturning.mockImplementation(() => Promise.resolve([mockPasswordReset]));

      const result = await repository.create(params);

      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith({
        userId: params.userId,
        tokenHash: params.tokenHash,
        expiresAt: params.expiresAt,
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
      };
      const mockUser = { id: "user-123", email: "user@example.com" };

      mockSelectResult = mockPasswordReset;
      mockLimit
        .mockImplementationOnce(() => Promise.resolve([mockPasswordReset]))
        .mockImplementationOnce(() => Promise.resolve([mockUser]));

      const result = await repository.findByToken({ tokenHash });

      expect(mockSelect).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result?.tokenHash).toBe(tokenHash);
    });

    it("should return null if token not found", async () => {
      mockLimit.mockImplementation(() => Promise.resolve([]));

      const result = await repository.findByToken({ tokenHash: "nonexistent" });

      expect(result).toBeNull();
    });
  });

  describe("markAsUsed", () => {
    it("should mark a password reset as used", async () => {
      const id = "reset-123";

      await repository.markAsUsed(id);

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ usedAt: expect.any(Date) })
      );
    });
  });

  describe("invalidateUnusedForUser", () => {
    it("should mark prior unused tokens as used", async () => {
      await repository.invalidateUnusedForUser("user-123");

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ usedAt: expect.any(Date) })
      );
    });
  });

  describe("deleteExpired", () => {
    it("should delete expired password reset records", async () => {
      await repository.deleteExpired();

      expect(mockDelete).toHaveBeenCalled();
      expect(mockDeleteWhere).toHaveBeenCalled();
    });
  });
});
