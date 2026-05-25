import { generateRandomToken } from "../../../../shared/utils/generate-random-token";

import { hashToken } from "../../../../shared/utils/hash-token";

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
}
