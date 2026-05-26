import { describe, expect, it, mock } from "bun:test";
import { ActivateUserUseCase } from "./activate-user.use-case";
import { createMockUserRepository, createMockAuthCache } from "../../test-helpers/fixtures";
import {
  UserNotFoundError,
  OperationNotAllowedError,
} from "../../../../shared/errors";

describe("ActivateUserUseCase", () => {
  it("should activate inactive user", async () => {
    const activate = mock(async () => {});
    const userRepository = createMockUserRepository({
      findById: mock(async () => ({
        id: "user-1",
        status: "INACTIVE",
      })),
      activate,
    });

    const useCase = new ActivateUserUseCase({
      userRepository,
      authCache: createMockAuthCache(),
    });

    await useCase.execute({ userId: "user-1", activatedBy: "admin-1" });

    expect(activate).toHaveBeenCalledWith("user-1");
  });

  it("should throw when user not found", async () => {
    const useCase = new ActivateUserUseCase({
      userRepository: createMockUserRepository({
        findById: mock(async () => null),
      }),
      authCache: createMockAuthCache(),
    });

    await expect(
      useCase.execute({ userId: "missing", activatedBy: "admin-1" })
    ).rejects.toThrow(UserNotFoundError);
  });

  it("should throw when already active", async () => {
    const useCase = new ActivateUserUseCase({
      userRepository: createMockUserRepository({
        findById: mock(async () => ({ id: "user-1", status: "ACTIVE" })),
      }),
      authCache: createMockAuthCache(),
    });

    await expect(
      useCase.execute({ userId: "user-1", activatedBy: "admin-1" })
    ).rejects.toThrow(OperationNotAllowedError);
  });
});
