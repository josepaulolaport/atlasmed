import type { InviteRepository } from "../interfaces/invite.repository.interface";

interface Dependencies {
  inviteRepository: InviteRepository;
}

export class RevokeInviteUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(params: { inviteId: string }) {
    const invite = await this.deps.inviteRepository.findById(params.inviteId);

    if (!invite) {
      throw new Error("Invite not found");
    }

    if (invite.status !== "PENDING") {
      throw new Error("Only pending invites can be revoked");
    }

    await this.deps.inviteRepository.revoke(params.inviteId);
  }
}
