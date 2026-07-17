import { describe, expect, it, mock } from "bun:test";
import { Role } from "@atlasmed/access";

import { GetUserByIdUseCase } from "./get-user-by-id.use-case";
import { createMockUserRepository } from "../../test-helpers/repository-mocks";
import { InsufficientPermissionsError, UserNotFoundError } from "../../../../shared/errors";

describe("GetUserByIdUseCase", () => {
  it("returns the serialized user for an ADMIN actor", async () => {
    const userRepository = createMockUserRepository({
      findById: mock(async () => ({
        id: "user-1",
        email: "rep@example.com",
        username: "rep1",
        firstName: "Rep",
        lastName: "One",
        avatarUrl: null,
        status: "ACTIVE",
        emailVerified: true,
        phoneVerified: false,
        role: { id: "role-rep", name: Role.REP },
        createdAt: new Date("2025-01-01T00:00:00.000Z"),
        updatedAt: new Date("2025-01-01T00:00:00.000Z"),
      })) as any,
    });

    const useCase = new GetUserByIdUseCase({ userRepository });
    const result = await useCase.execute({ targetUserId: "user-1", actorRole: Role.ADMIN });

    expect(result.id).toBe("user-1");
    expect(result.username).toBe("rep1");
  });

  it("rejects non-ADMIN actors", async () => {
    const userRepository = createMockUserRepository();
    const useCase = new GetUserByIdUseCase({ userRepository });

    await expect(
      useCase.execute({ targetUserId: "user-1", actorRole: Role.MANAGER })
    ).rejects.toThrow(InsufficientPermissionsError);
  });

  it("throws UserNotFoundError when the user does not exist", async () => {
    const userRepository = createMockUserRepository({
      findById: mock(() => Promise.resolve(null)),
    });
    const useCase = new GetUserByIdUseCase({ userRepository });

    await expect(
      useCase.execute({ targetUserId: "missing", actorRole: Role.ADMIN })
    ).rejects.toThrow(UserNotFoundError);
  });
});
