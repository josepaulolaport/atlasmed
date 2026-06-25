import { beforeEach, describe, expect, it, mock } from "bun:test";
import { createMockAuditLogService } from "../../test-helpers/audit-mocks";
import { createMockMetricsService } from "../../test-helpers/metrics-mocks";

const mockLogResendInvite = mock(async () => {});

import { ResendInviteUseCase } from "./resend-invite.use-case";
import { InviteService } from "../services/invite.service";
import {
  createMockInviteRepository,
} from "../../test-helpers/fixtures";
import { createGlobalScopeContext, Role } from "@atlasmed/access";
import { scopedManagerContext } from "../../test-helpers/route-test-context";
import {
  InviteNotFoundError,
  InsufficientPermissionsError,
  OperationNotAllowedError,
} from "../../../../shared/errors";

describe("ResendInviteUseCase", () => {
  const baseInvite = {
    id: "invite-123",
    email: "user@example.com",
    phoneNumber: null,
    tokenHash: "old-hash",
    roleId: "role-123",
    invitedByUserId: "manager-1",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    status: "PENDING",
    resendCount: 0,
    lastResendAt: null,
    revokedAt: null,
    createdAt: new Date(),
    acceptedAt: null,
    role: { id: "role-123", name: "USER" },
  };

  let useCase: ResendInviteUseCase;
  let mockInviteRepository: ReturnType<typeof createMockInviteRepository>;

  beforeEach(() => {
    mockLogResendInvite.mockClear();

    mockInviteRepository = createMockInviteRepository({
      findById: mock(async () => ({ ...baseInvite })),
      regenerateToken: mock(async () => ({
        ...baseInvite,
        tokenHash: "new-hash",
        resendCount: 1,
        lastResendAt: new Date(),
      })),
    });

    const inviteService = new InviteService({ inviteRepository: mockInviteRepository });

    useCase = new ResendInviteUseCase({
      inviteRepository: mockInviteRepository,
      inviteService,
      auditLog: createMockAuditLogService({
        logResendInvite: mockLogResendInvite,
      }),
      metrics: createMockMetricsService(),
    });
  });

  it("should rotate token and audit resend for manager-owned invite", async () => {
    const result = await useCase.execute({
      inviteId: "invite-123",
      actorId: "manager-1",
      actorRole: Role.MANAGER,
      scope: scopedManagerContext({
        territoryIds: ["t-1"],
        grantIds: [],
      }),
    });

    expect(result.token).toBeDefined();
    expect(mockInviteRepository.regenerateToken).toHaveBeenCalled();
    expect(mockLogResendInvite).toHaveBeenCalled();
  });

  it("should allow admin to resend any invite", async () => {
    await expect(
      useCase.execute({
        inviteId: "invite-123",
        actorId: "admin-1",
        actorRole: Role.ADMIN,
        scope: createGlobalScopeContext(),
      })
    ).resolves.toBeDefined();
  });

  it("should reject manager resending another manager invite", async () => {
    await expect(
      useCase.execute({
        inviteId: "invite-123",
        actorId: "manager-2",
        actorRole: Role.MANAGER,
        scope: scopedManagerContext({
          territoryIds: [],
          grantIds: [],
        }),
      })
    ).rejects.toThrow(InsufficientPermissionsError);
  });

  it("should throw when invite not found", async () => {
    mockInviteRepository.findById = mock(async () => null);

    await expect(
      useCase.execute({
        inviteId: "missing",
        actorId: "admin-1",
        actorRole: Role.ADMIN,
        scope: createGlobalScopeContext(),
      })
    ).rejects.toThrow(InviteNotFoundError);
  });

  it("should reject non-pending invite", async () => {
    mockInviteRepository.findById = mock(async () => ({
      ...baseInvite,
      status: "ACCEPTED",
    }));

    await expect(
      useCase.execute({
        inviteId: "invite-123",
        actorId: "admin-1",
        actorRole: Role.ADMIN,
        scope: createGlobalScopeContext(),
      })
    ).rejects.toThrow(OperationNotAllowedError);
  });

  it("should reject when max resends reached", async () => {
    mockInviteRepository.findById = mock(async () => ({
      ...baseInvite,
      resendCount: 5,
    }));

    await expect(
      useCase.execute({
        inviteId: "invite-123",
        actorId: "admin-1",
        actorRole: Role.ADMIN,
        scope: createGlobalScopeContext(),
      })
    ).rejects.toThrow(OperationNotAllowedError);
  });
});
