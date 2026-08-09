import { describe, expect, it, mock } from "bun:test";
import { ActivateUserUseCase } from "./activate-user.use-case";
import { createMockUserRepository, createMockAuthCache } from "../../test-helpers/fixtures";
import { createMockAuditLogService } from "../../test-helpers/audit-mocks";
import {
  UserNotFoundError,
  OperationNotAllowedError,
} from "../../../../shared/errors";

describe("ActivateUserUseCase", () => {
  it("should activate inactive user", async () => {
    const activate = mock(async () => {});
    const userRepository = createMockUserRepository({
      findById: mock(async () => ({
        id: 1,
        status: "INACTIVE",
      })) as any,
      activate,
    });

    const useCase = new ActivateUserUseCase({
      userRepository,
      authCache: createMockAuthCache(),
      auditLog: createMockAuditLogService(),
    });

    await useCase.execute({ userId: 1, activatedBy: 1 });

    expect(activate).toHaveBeenCalledWith(1);
  });

  it("should throw when user not found", async () => {
    const useCase = new ActivateUserUseCase({
      userRepository: createMockUserRepository({
        findById: mock(async () => null),
      }),
      authCache: createMockAuthCache(),
      auditLog: createMockAuditLogService(),
    });

    await expect(
      useCase.execute({ userId: 999, activatedBy: 1 })
    ).rejects.toThrow(UserNotFoundError);
  });

  it("should throw when already active", async () => {
    const useCase = new ActivateUserUseCase({
      userRepository: createMockUserRepository({
        findById: mock(async () => ({ id: 1, status: "ACTIVE" })) as any,
      }),
      authCache: createMockAuthCache(),
      auditLog: createMockAuditLogService(),
    });

    await expect(
      useCase.execute({ userId: 1, activatedBy: 1 })
    ).rejects.toThrow(OperationNotAllowedError);
  });
});
