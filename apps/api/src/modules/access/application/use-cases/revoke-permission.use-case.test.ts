import { beforeEach, describe, expect, it, mock } from "bun:test";
import { RevokePermissionUseCase } from "./revoke-permission.use-case";
import type { AccessGrantService } from "../services/access-grant.service";
import { Role } from "@atlasmed/access";
import { InsufficientPermissionsError } from "../../../../shared/errors";

describe("RevokePermissionUseCase", () => {
  let useCase: RevokePermissionUseCase;
  let mockAccessGrantService: AccessGrantService;

  beforeEach(() => {
    mockAccessGrantService = {
      revokePermission: mock(async () => {}),
    } as unknown as AccessGrantService;

    useCase = new RevokePermissionUseCase({
      accessGrantService: mockAccessGrantService,
    });
  });

  it("should revoke permission when actor is admin", async () => {
    await useCase.execute({
      targetUserId: "user-123",
      resource: "CLINIC",
      resourceId: "clinic-1",
      action: "update",
      revokedBy: "admin-1",
      actorRole: Role.ADMIN,
    });

    expect(mockAccessGrantService.revokePermission).toHaveBeenCalledWith({
      userId: "user-123",
      resource: "CLINIC",
      resourceId: "clinic-1",
      action: "update",
      revokedBy: "admin-1",
    });
  });

  it("should throw when actor is not admin", async () => {
    await expect(
      useCase.execute({
        targetUserId: "user-123",
        resource: "CLINIC",
        action: "update",
        revokedBy: "manager-1",
        actorRole: Role.MANAGER,
      })
    ).rejects.toThrow(InsufficientPermissionsError);

    expect(mockAccessGrantService.revokePermission).not.toHaveBeenCalled();
  });
});
