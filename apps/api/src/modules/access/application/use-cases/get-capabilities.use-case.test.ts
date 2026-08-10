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
    id: "user-123",
    role: { name: "MANAGER" },
  };

  beforeEach(() => {
    mockAccessGrantService = {
      getActiveGrants: mock(async () => [
        {
          id: "grant-1",
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

  it("returns the ordered CASL rule projection and omits scoped grant rules", async () => {
    const result = await useCase.execute({ userId: "user-123" });

    expect(result).toEqual({
      version: 2,
      capabilities: [
        { action: "create", subject: "VISIT" },
        { action: "read", subject: "VISIT" },
        { action: "read", subject: "CALENDAR" },
        { action: "read", subject: "INTERACTION" },
        { action: "read", subject: "USER" },
        { action: "update", subject: "USER" },
        { action: "create", subject: "USER" },
        { action: "create", subject: "INVITATION" },
        { action: "update", subject: "INVITATION" },
        { action: "delete", subject: "INVITATION" },
        { action: "read", subject: "FACILITY" },
        { action: "update", subject: "FACILITY" },
        { action: "read", subject: "PERSON" },
        { action: "update", subject: "PERSON" },
        { action: "read", subject: "TERRITORY" },
        { action: "create", subject: "TERRITORY" },
        { action: "update", subject: "TERRITORY" },
        { action: "read", subject: "REGISTRY_SUGGESTION" },
        { action: "update", subject: "REGISTRY_SUGGESTION" },
        { action: "read", subject: "REGISTRY_INGESTION" },
        { action: "read", subject: "CATALOG" },
        { action: "create", subject: "FIELD_SUGGESTION" },
        { action: "read", subject: "FIELD_SUGGESTION" },
        { action: "update", subject: "FIELD_SUGGESTION" },
        { action: "read", subject: "CADASTRO_SUBMISSION" },
        { action: "update", subject: "CADASTRO_SUBMISSION" },
      ],
    });
  });

  it("should include global grants in capability derivation", async () => {
    mockAccessGrantService = {
      getActiveGrants: mock(async () => [
        {
          id: "grant-2",
          resource: "user",
          resourceId: undefined,
          action: "manage",
          conditions: null,
          expiresAt: null,
        },
      ]),
    };

    useCase = new GetCapabilitiesUseCase({
      userRepository: createMockUserRepository({
        findById: mock(async () => ({ id: "user-123", role: { name: "REP" } })) as any,
      }),
      accessGrantService: mockAccessGrantService as any,
    });

    const result = await useCase.execute({ userId: "user-123" });

    expect(result.capabilities.at(-1)).toEqual({
      action: "manage",
      subject: "USER",
    });
  });

  it("should reject when user not found", async () => {
    useCase = new GetCapabilitiesUseCase({
      userRepository: createMockUserRepository({
        findById: mock(async () => null),
      }),
      accessGrantService: mockAccessGrantService as any,
    });

    await expect(useCase.execute({ userId: "missing" })).rejects.toThrow(
      UserNotFoundError
    );
  });
});
