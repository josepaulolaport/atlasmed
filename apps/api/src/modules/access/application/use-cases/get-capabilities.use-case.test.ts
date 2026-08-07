import { beforeEach, describe, expect, it, mock } from "bun:test";
import { GetCapabilitiesUseCase } from "./get-capabilities.use-case";
import { createMockUserRepository } from "../../test-helpers/fixtures";
import { UserNotFoundError } from "../../../../shared/errors";

describe("GetCapabilitiesUseCase", () => {
  let useCase: GetCapabilitiesUseCase;
  let mockAccessGrantService: {
    getActiveGrants: ReturnType<typeof mock>;
  };

  const mockUser = {
    id: 123,
    role: { name: "MANAGER" },
  };

  beforeEach(() => {
    mockAccessGrantService = {
      getActiveGrants: mock(async () => [
        {
          id: 1,
          resource: "clinic",
          resourceId: "clinic-1",
          action: "read",
          conditions: null,
          expiresAt: null,
        },
      ]),
    };

    useCase = new GetCapabilitiesUseCase({
      userRepository: createMockUserRepository({
        findById: mock(async () => mockUser) as any,
      }),
      accessGrantService: mockAccessGrantService as any,
    });
  });

  it("should return role and active grants", async () => {
    const result = await useCase.execute({ userId: 123 });

    expect(result.role).toBe("MANAGER");
    expect(result.grants).toHaveLength(1);
    expect(result.grants[0]?.resourceId).toBe("clinic-1");
  });

  it("should reject when user not found", async () => {
    useCase = new GetCapabilitiesUseCase({
      userRepository: createMockUserRepository({
        findById: mock(async () => null),
      }),
      accessGrantService: mockAccessGrantService as any,
    });

    await expect(useCase.execute({ userId: 999 })).rejects.toThrow(
      UserNotFoundError
    );
  });
});
