import { beforeEach, describe, expect, it, mock } from "bun:test";

import { DrizzleVerificationTokenRepository } from "./drizzle-verification-token.repository";

// Track calls for assertions
let lastDeletedWhere: any;
let lastInsertedValues: any;
let mockSelectResult: any = null;
let lastUpdateWhere: any;

const mockDeleteWhere = mock((expr: any) => {
  lastDeletedWhere = expr;
  return Promise.resolve();
});
const mockDeleteFn = mock(() => ({ where: mockDeleteWhere }));

const mockReturningVoid = mock(() => Promise.resolve());
const mockValues = mock((vals: any) => {
  lastInsertedValues = vals;
  return mockReturningVoid();
});
const mockInsert = mock(() => ({ values: mockValues }));

const mockLimit = mock(() =>
  Promise.resolve(mockSelectResult !== null ? [mockSelectResult] : [])
);
const mockSelectWhere = mock(() => ({ limit: mockLimit }));
const mockFromInner = mock(() => ({ where: mockSelectWhere }));
const mockSelect = mock(() => ({ from: mockFromInner }));

const mockUpdateWhere = mock((expr: any) => {
  lastUpdateWhere = expr;
  return Promise.resolve();
});
const mockSet = mock(() => ({ where: mockUpdateWhere }));
const mockUpdate = mock(() => ({ set: mockSet }));

mock.module("../../../../../infrastructure/database/db", () => ({
  db: {
    delete: mockDeleteFn,
    insert: mockInsert,
    select: mockSelect,
    update: mockUpdate,
  },
}));

describe("DrizzleVerificationTokenRepository", () => {
  let repository: DrizzleVerificationTokenRepository;

  beforeEach(() => {
    lastDeletedWhere = undefined;
    lastInsertedValues = undefined;
    mockSelectResult = null;
    lastUpdateWhere = undefined;
    mockDeleteWhere.mockClear();
    mockDeleteFn.mockClear();
    mockReturningVoid.mockClear();
    mockValues.mockClear();
    mockInsert.mockClear();
    mockLimit.mockClear();
    mockSelectWhere.mockClear();
    mockFromInner.mockClear();
    mockSelect.mockClear();
    mockUpdateWhere.mockClear();
    mockSet.mockClear();
    mockUpdate.mockClear();

    repository = new DrizzleVerificationTokenRepository();
  });

  describe("deleteUnusedByUserAndType", () => {
    it("should delete unverified tokens for user and type", async () => {
      await repository.deleteUnusedByUserAndType("user-123", "EMAIL_VERIFICATION");

      expect(mockDeleteFn).toHaveBeenCalled();
      expect(mockDeleteWhere).toHaveBeenCalled();
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

      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: params.userId,
          type: params.type,
          tokenHash: params.tokenHash,
          newValue: params.newValue,
          expiresAt: params.expiresAt,
        })
      );
    });
  });

  describe("findValidToken", () => {
    it("should find a valid unverified token", async () => {
      const mockToken = {
        id: "token-123",
        newValue: null,
      };

      mockSelectResult = mockToken;
      mockLimit.mockImplementation(() => Promise.resolve([mockToken]));

      const result = await repository.findValidToken({
        tokenHash: "hash-123",
        userId: "user-123",
        type: "EMAIL_VERIFICATION",
      });

      expect(mockSelect).toHaveBeenCalled();
      expect(result).toEqual(mockToken);
    });

    it("should return null if token not found", async () => {
      mockLimit.mockImplementation(() => Promise.resolve([]));

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

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ verifiedAt: expect.any(Date) })
      );
    });
  });
});
