import type { InviteRepository } from "../interfaces/invite.repository.interface";
import { auditLogService } from "../../../../infrastructure/audit/audit-log.service";

interface Dependencies {
  inviteRepository: InviteRepository;
}

export class RevokeInviteUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(params: { inviteId: string; revokedByUserId: string }) {
    const invite = await this.deps.inviteRepository.findById(params.inviteId);

    if (!invite) {
      throw new Error("Invite not found");
    }

    if (invite.status !== "PENDING") {
      throw new Error("Only pending invites can be revoked");
    }

    await this.deps.inviteRepository.revoke(params.inviteId);

    await auditLogService.logRevokeInvite({
      revokedByUserId: params.revokedByUserId,
      inviteId: params.inviteId,
      email: invite.email || undefined,
      phoneNumber: invite.phoneNumber || undefined,
    });
  }
}
