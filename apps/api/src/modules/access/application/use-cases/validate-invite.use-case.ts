import type { InviteRepository } from "../interfaces/invite.repository.interface";
import { normalizeInviteCode } from "../../../../shared/utils/generate-invite-code";
import { hashToken } from "../../../../shared/utils/hash-token";
import { InvalidInviteError } from "../../../../shared/errors";

interface Dependencies {
  inviteRepository: InviteRepository;
}

export class ValidateInviteUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(params: { token: string }) {
    const token = normalizeInviteCode(params.token);

    if (!token) {
      throw new InvalidInviteError();
    }

    const invite = await this.deps.inviteRepository.findValidByTokenHash(
      hashToken(token)
    );

    if (!invite) {
      throw new InvalidInviteError();
    }

    return {
      email: invite.email ?? undefined,
      phoneNumber: invite.phoneNumber ?? undefined,
      firstName: invite.firstName ?? undefined,
      lastName: invite.lastName ?? undefined,
      role: {
        id: invite.role.id,
        name: invite.role.name,
      },
      expiresAt: invite.expiresAt.toISOString(),
    };
  }
}
