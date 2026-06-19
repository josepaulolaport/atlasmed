import type { InviteRepository } from "../interfaces/invite.repository.interface";
import { InviteService } from "../services/invite.service";
import { environment } from "../../../../app/config/environment";
import {
  InviteNotFoundError,
  InsufficientPermissionsError,
  OperationNotAllowedError,
  RateLimitExceededError,
} from "../../../../shared/errors";
import type { Role, ScopeContext } from "@atlasmed/access";
import type { IAuditLog } from "../interfaces/audit-log.interface";
import type { IMetrics } from "../interfaces/metrics.interface";

interface Dependencies {
  inviteRepository: InviteRepository;
  inviteService: InviteService;
  auditLog: IAuditLog;
  metrics: IMetrics;
}

interface ResendInviteInput {
  inviteId: string;
  actorId: string;
  actorRole: Role;
  scope: ScopeContext;
}

export class ResendInviteUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: ResendInviteInput) {
    const invite = await this.deps.inviteRepository.findById(input.inviteId);

    if (!invite) {
      throw new InviteNotFoundError(input.inviteId);
    }

    if (!input.scope.isGlobal && input.actorRole === "MANAGER") {
      if (invite.invitedByUserId !== input.actorId) {
        throw new InsufficientPermissionsError(
          ["invitation:resend"],
          [`invite:${invite.id}`]
        );
      }
    }

    if (invite.status !== "PENDING" || invite.revokedAt) {
      throw new OperationNotAllowedError(
        "resend_invite",
        "Only pending invitations can be resent"
      );
    }

    if (invite.expiresAt < new Date()) {
      throw new OperationNotAllowedError(
        "resend_invite",
        "Invitation has expired"
      );
    }

    const maxResends = environment.INVITE_MAX_RESENDS;
    if ((invite.resendCount ?? 0) >= maxResends) {
      throw new OperationNotAllowedError(
        "resend_invite",
        `Maximum resend limit (${maxResends}) reached for this invitation`
      );
    }

    const cooldownMs = environment.INVITE_RESEND_COOLDOWN_MINUTES * 60 * 1000;
    if (invite.lastResendAt) {
      const elapsed = Date.now() - new Date(invite.lastResendAt).getTime();
      if (elapsed < cooldownMs) {
        throw new RateLimitExceededError(cooldownMs - elapsed);
      }
    }

    const { invite: updated, token } = await this.deps.inviteService.rotateInviteToken(
      input.inviteId
    );

    await this.deps.auditLog.logResendInvite({
      resentByUserId: input.actorId,
      inviteId: updated.id,
      email: updated.email ?? undefined,
      phoneNumber: updated.phoneNumber ?? undefined,
      resendCount: updated.resendCount,
    });

    const channel = updated.email ? "email" : "phone";
    this.deps.metrics.recordInvite(channel, "resend");

    return { invite: updated, token };
  }
}
