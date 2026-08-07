import { beforeEach, describe, expect, it, mock } from "bun:test";
import { GrantPermissionUseCase } from "./grant-permission.use-case";
import type { AccessGrantService } from "../services/access-grant.service";
import type { UserRepository } from "../interfaces/user.repository.interface";
import { createMockUserRepository } from "../../test-helpers/repository-mocks";
import { Role } from "@atlasmed/access";
import {
  InsufficientPermissionsError,
  UserNotFoundError,
} from "../../../../shared/errors";

describe("GrantPermissionUseCase", () => {
  let useCase: GrantPermissionUseCase;
  let mockAccessGrantService: AccessGrantService;
  let mockUserRepository: UserRepository;

  const mockGrant = {
    id: 1,
    resource: "FACILITY",
    resourceId: "1",
    action: "update",
  };

  beforeEach(() => {
    mockAccessGrantService = {
      grantPermission: mock(async () => mockGrant),
    } as unknown as AccessGrantService;

    mockUserRepository = createMockUserRepository({
      findById: mock(async () => ({ id: 123 })) as any,
    });

    useCase = new GrantPermissionUseCase({
      accessGrantService: mockAccessGrantService,
      userRepository: mockUserRepository,
    });
  });

  it("should grant permission when actor is admin and target exists", async () => {
    const result = await useCase.execute({
      targetUserId: 123,
      resource: "FACILITY",
      resourceId: 1,
      action: "update",
      grantedBy: 1,
      actorRole: Role.ADMIN,
    });

    expect(result).toEqual(mockGrant);
    expect(mockAccessGrantService.grantPermission).toHaveBeenCalledWith({
      userId: 123,
      resource: "FACILITY",
      resourceId: "1",
      action: "update",
      conditions: undefined,
      grantedBy: 1,
      expiresAt: undefined,
    });
  });

  it("should validate and forward grant conditions", async () => {
    await useCase.execute({
      targetUserId: 123,
      resource: "FACILITY",
      resourceId: 1,
      action: "read",
      conditions: { id: "1" },
      grantedBy: 1,
      actorRole: Role.ADMIN,
    });

    expect(mockAccessGrantService.grantPermission).toHaveBeenCalledWith(
      expect.objectContaining({
        conditions: { id: "1" },
      })
    );
  });

  it("should normalize legacy CLINIC grant resource to FACILITY", async () => {
    await useCase.execute({
      targetUserId: 123,
      resource: "CLINIC",
      resourceId: 1,
      action: "read",
      grantedBy: 1,
      actorRole: Role.ADMIN,
    });

    expect(mockAccessGrantService.grantPermission).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: "FACILITY",
        resourceId: "1",
      })
    );
  });

  it("should throw when actor is not admin", async () => {
    await expect(
      useCase.execute({
        targetUserId: 123,
        resource: "FACILITY",
        action: "update",
        grantedBy: 1,
        actorRole: Role.MANAGER,
      })
    ).rejects.toThrow(InsufficientPermissionsError);

    expect(mockAccessGrantService.grantPermission).not.toHaveBeenCalled();
  });

  it("should throw when target user not found", async () => {
    mockUserRepository.findById = mock(async () => null);

    await expect(
      useCase.execute({
        targetUserId: 999,
        resource: "FACILITY",
        action: "update",
        grantedBy: 1,
        actorRole: Role.ADMIN,
      })
    ).rejects.toThrow(UserNotFoundError);

    expect(mockAccessGrantService.grantPermission).not.toHaveBeenCalled();
  });
});
