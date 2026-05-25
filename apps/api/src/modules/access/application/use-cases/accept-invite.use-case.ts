import type { InviteRepository } from "../interfaces/invite.repository.interface";
import { PasswordService } from "../services/password.service";
import { hashToken } from "../../../../shared/utils/hash-token";

interface Dependencies {
  inviteRepository: InviteRepository;
}

interface AcceptInviteParams {
  token: string;
  email: string;
  phoneNumber?: string | undefined;
  username: string;
  password: string;
  firstName?: string | undefined;
  lastName?: string | undefined;
}

export class AcceptInviteUseCase {
  private readonly passwordService = new PasswordService();

  constructor(private readonly deps: Dependencies) {}

  async execute(params: AcceptInviteParams) {
    const tokenHash = hashToken(params.token);
    const passwordHash = await this.passwordService.hash(params.password);

    const result = await this.deps.inviteRepository.acceptInviteTransaction({
      tokenHash,
      email: params.email,
      phoneNumber: params.phoneNumber,
      username: params.username,
      passwordHash,
      firstName: params.firstName,
      lastName: params.lastName,
    });

    return result.user;
  }
}
