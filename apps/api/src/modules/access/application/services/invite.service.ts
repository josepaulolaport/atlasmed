import { generateInviteCode } from "../../../../shared/utils/generate-invite-code";
import { hashToken } from "../../../../shared/utils/hash-token";
import { environment } from "../../../../app/config/environment";
import type { InviteRepository } from "../interfaces/invite.repository.interface";

interface Dependencies {
  inviteRepository: InviteRepository;
}

interface CreateInviteParams {
  email?: string | undefined;
  phoneNumber?: string | undefined;
  roleId: number;
  invitedByUserId: number;
  firstName?: string | undefined;
  lastName?: string | undefined;
  birthDate?: Date | undefined;
  managerTerritoryId?: number | undefined;
  repTerritoryId?: number | undefined;
  verticalAssignments?: Array<{
    verticalId: number;
    territoryIds: number[];
  }>;
}

export class InviteService {
  constructor(private readonly deps: Dependencies) {}

  async createInvite(params: CreateInviteParams) {
    const token = generateInviteCode();
    const tokenHash = hashToken(token);

    const invite = await this.deps.inviteRepository.create({
      email: params.email || undefined,
      phoneNumber: params.phoneNumber || undefined,
      tokenHash,
      roleId: params.roleId,
      invitedByUserId: params.invitedByUserId,
      firstName: params.firstName,
      lastName: params.lastName,
      birthDate: params.birthDate,
      managerTerritoryId: params.managerTerritoryId,
      repTerritoryId: params.repTerritoryId,
      verticalAssignments: params.verticalAssignments,
      expiresAt: new Date(
        Date.now() + environment.INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
      ),
    });

    return {
      invite,
      token,
    };
  }

  buildRotatedInviteCredentials() {
    const token = generateInviteCode();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(
      Date.now() + environment.INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    );

    return { token, tokenHash, expiresAt };
  }

  async rotateInviteToken(inviteId: number) {
    const { token, tokenHash, expiresAt } = this.buildRotatedInviteCredentials();

    const invite = await this.deps.inviteRepository.regenerateToken(inviteId, {
      tokenHash,
      expiresAt,
    });

    return { invite, token };
  }
}
