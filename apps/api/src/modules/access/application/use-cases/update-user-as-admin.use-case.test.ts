import { describe, expect, it, mock } from "bun:test";
import { Role } from "@atlasmed/access";
import { UpdateUserAsAdminUseCase } from "./update-user-as-admin.use-case";
import { createMockUserRepository } from "../../test-helpers/repository-mocks";
import {
  InsufficientPermissionsError,
  ResourceConflictError,
  UserNotFoundError,
  ValidationError,
} from "../../../../shared/errors";

describe("UpdateUserAsAdminUseCase", () => {
  it("updates profile fields for ADMIN", async () => {
    const updated = {
      id: "user-1",
      email: "new@example.com",
      username: "newuser",
      firstName: "New",
      lastName: "Name",
      phoneNumber: "+5511999999999",
      birthDate: new Date("1990-01-15"),
      status: "ACTIVE",
      emailVerified: false,
      phoneVerified: false,
      twoFactorEnabled: false,
      avatarUrl: null,
      role: { id: "role-1", name: Role.REP },
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-06-01"),
    };

    const userRepository = createMockUserRepository({
      findById: mock(async () => ({
        id: "user-1",
        email: "old@example.com",
        username: "olduser",
        phoneNumber: null,
        role: { id: "role-1", name: Role.REP },
      })) as any,
      findByEmail: mock(async () => null),
      findByUsername: mock(async () => null),
      findByPhone: mock(async () => null),
      updateAsAdmin: mock(async () => updated as any),
    });

    const authCache = { invalidate: mock(async () => {}) };
    const useCase = new UpdateUserAsAdminUseCase({
      userRepository,
      authCache: authCache as any,
    });

    const result = await useCase.execute({
      targetUserId: "user-1",
      actorRole: Role.ADMIN,
      data: {
        email: "new@example.com",
        username: "newuser",
        firstName: "New",
        lastName: "Name",
        phoneNumber: "+5511999999999",
        birthDate: new Date("1990-01-15"),
      },
    });

    expect(result.email).toBe("new@example.com");
    expect(result.birthDate).toBe(new Date("1990-01-15").toISOString());
    expect(authCache.invalidate).toHaveBeenCalledWith("user-1");
  });

  it("rejects non-admin", async () => {
    const useCase = new UpdateUserAsAdminUseCase({
      userRepository: createMockUserRepository(),
      authCache: { invalidate: mock(async () => {}) } as any,
    });

    await expect(
      useCase.execute({
        targetUserId: "user-1",
        actorRole: Role.MANAGER,
        data: { firstName: "X" },
      }),
    ).rejects.toBeInstanceOf(InsufficientPermissionsError);
  });

  it("rejects empty body", async () => {
    const useCase = new UpdateUserAsAdminUseCase({
      userRepository: createMockUserRepository({
        findById: mock(async () => ({ id: "user-1" }) as any),
      }),
      authCache: { invalidate: mock(async () => {}) } as any,
    });

    await expect(
      useCase.execute({
        targetUserId: "user-1",
        actorRole: Role.ADMIN,
        data: {},
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects email conflict", async () => {
    const useCase = new UpdateUserAsAdminUseCase({
      userRepository: createMockUserRepository({
        findById: mock(async () => ({
          id: "user-1",
          email: "old@example.com",
          username: "u",
        }) as any),
        findByEmail: mock(async () => ({ id: "other" })),
      }),
      authCache: { invalidate: mock(async () => {}) } as any,
    });

    await expect(
      useCase.execute({
        targetUserId: "user-1",
        actorRole: Role.ADMIN,
        data: { email: "taken@example.com" },
      }),
    ).rejects.toBeInstanceOf(ResourceConflictError);
  });

  it("throws when user missing", async () => {
    const useCase = new UpdateUserAsAdminUseCase({
      userRepository: createMockUserRepository(),
      authCache: { invalidate: mock(async () => {}) } as any,
    });

    await expect(
      useCase.execute({
        targetUserId: "missing",
        actorRole: Role.ADMIN,
        data: { firstName: "X" },
      }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });
});
