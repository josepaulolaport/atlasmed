import { generateRandomToken } from "../../../../shared/utils/generate-random-token";

import { hashToken } from "../../../../shared/utils/hash-token";

import { environment } from "../../../../app/config/environment";

import type { InviteRepository } from "../interfaces/invite.repository.interface";

interface Dependencies {
  inviteRepository: InviteRepository;
}

interface CreateInviteParams {
  email?: string | undefined;
  phoneNumber?: string | undefined;
  roleId: string;
  invitedByUserId: string;
}

export class InviteService {
  constructor(private readonly deps: Dependencies) {}

  async createInvite(params: CreateInviteParams) {
    const token = generateRandomToken();

    const tokenHash = hashToken(token);

    const invite = await this.deps.inviteRepository.create({
      email: params.email || undefined,
      phoneNumber: params.phoneNumber || undefined,
      tokenHash,
      roleId: params.roleId,
      invitedByUserId: params.invitedByUserId,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    });

    return {
      invite,

      token,
    };
  }

  buildRotatedInviteCredentials() {
    const token = generateRandomToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(
      Date.now() + environment.INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    );

    return { token, tokenHash, expiresAt };
  }

  async rotateInviteToken(inviteId: string) {
    const { token, tokenHash, expiresAt } = this.buildRotatedInviteCredentials();

    const invite = await this.deps.inviteRepository.regenerateToken(inviteId, {
      tokenHash,
      expiresAt,
    });

    return { invite, token };
  }
}
