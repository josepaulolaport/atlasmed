import { beforeEach, describe, expect, it, mock } from "bun:test";
import { UpdateProfileUseCase } from "./update-profile.use-case";
import type { UserRepository } from "../interfaces/user.repository.interface";
import type { IAuthCache } from "../interfaces/auth-cache.interface";
import {
  createMockUserRepository,
  createMockAuthCache,
  createMockUserWithRole,
} from "../../test-helpers/fixtures";

describe("UpdateProfileUseCase", () => {
  let updateProfileUseCase: UpdateProfileUseCase;
  let mockUserRepository: UserRepository;
  let mockAuthCache: IAuthCache;

  const mockUser = createMockUserWithRole();

  beforeEach(() => {
    mockUserRepository = createMockUserRepository({
      findById: mock(async () => mockUser),
      updateProfile: mock(async () => ({
        ...mockUser,
        firstName: "Updated",
        lastName: "Name",
      })),
    });

    mockAuthCache = createMockAuthCache();

    updateProfileUseCase = new UpdateProfileUseCase({
      userRepository: mockUserRepository,
      authCache: mockAuthCache,
    });
  });

  it("should update profile fields", async () => {
    const result = await updateProfileUseCase.execute({
      userId: "user-123",
      firstName: "Updated",
      lastName: "Name",
    });

    expect(mockUserRepository.updateProfile).toHaveBeenCalledWith("user-123", {
      firstName: "Updated",
      lastName: "Name",
      avatarUrl: undefined,
    });
    expect(result.firstName).toBe("Updated");
    expect(result.lastName).toBe("Name");
  });

  it("should invalidate auth cache after update", async () => {
    await updateProfileUseCase.execute({
      userId: "user-123",
      firstName: "Updated",
    });

    expect(mockAuthCache.invalidate).toHaveBeenCalledWith("user-123");
  });

  it("should reject empty patch", async () => {
    await expect(
      updateProfileUseCase.execute({ userId: "user-123" })
    ).rejects.toThrow("Request validation failed");

    expect(mockUserRepository.updateProfile).not.toHaveBeenCalled();
  });

  it("should throw when user not found", async () => {
    mockUserRepository.findById = mock(async () => null);

    await expect(
      updateProfileUseCase.execute({ userId: "non-existent", firstName: "Test" })
    ).rejects.toThrow("User not found");

    expect(mockUserRepository.updateProfile).not.toHaveBeenCalled();
  });
});
