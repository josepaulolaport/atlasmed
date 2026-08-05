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

  it("should return versioned capabilities and ignore resource-scoped grants for type-level decisions", async () => {
    const result = await useCase.execute({ userId: "user-123" });

    expect(result.version).toBe(1);
    expect(result.capabilities).toEqual(
      expect.arrayContaining([
        "agenda.read",
        "catalog.read",
        "cadastro.read",
        "cadastro.review",
        "field-suggestion.read",
        "field-suggestion.review",
        "facility.read",
        "facility.update",
        "professional.read",
        "professional.update",
        "territory.read",
        "territory.create",
        "territory.update",
        "user.read",
        "user.lifecycle",
      ])
    );
    expect(result.capabilities).not.toContain("agenda.create");
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

    expect(result.capabilities).toContain("user.manage");
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
