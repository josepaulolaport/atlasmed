import { Role } from "@atlasmed/access";
import type { InviteRepository } from "../interfaces/invite.repository.interface";
import type { IAuditLog } from "../interfaces/audit-log.interface";
import { ForbiddenError } from "../../../../shared/errors";

interface Dependencies {
  inviteRepository: InviteRepository;
  auditLog: IAuditLog;
}

export class RevokeInviteUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(params: {
    inviteId: string;
    revokedByUserId: string;
    actorRole: Role;
  }) {
    const invite = await this.deps.inviteRepository.findById(params.inviteId);

    if (!invite) {
      throw new Error("Invite not found");
    }

    if (invite.status !== "PENDING") {
      throw new Error("Only pending invites can be revoked");
    }

    if (
      params.actorRole === Role.MANAGER &&
      invite.invitedByUserId !== params.revokedByUserId
    ) {
      throw new ForbiddenError();
    }

    await this.deps.inviteRepository.revoke(params.inviteId);

    await this.deps.auditLog.logRevokeInvite({
      revokedByUserId: params.revokedByUserId,
      inviteId: params.inviteId,
      email: invite.email || undefined,
      phoneNumber: invite.phoneNumber || undefined,
    });
  }
}
