import type { InviteRepository } from "../interfaces/invite.repository.interface";
import { PasswordService } from "../services/password.service";
import { hashToken } from "../../../../shared/utils/hash-token";
import { auditLogService } from "../../../../infrastructure/audit/audit-log.service";
import { validatePassword } from "@atlasmed/access";
import { InvalidPasswordError } from "../../../../shared/errors";

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
    const passwordCheck = validatePassword(params.password);
    if (!passwordCheck.valid) {
      throw new InvalidPasswordError([...passwordCheck.errors]);
    }

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

    await auditLogService.logUserRegister({
      userId: result.user.id,
      username: result.user.username,
      email: result.user.email,
    });

    await auditLogService.logAcceptInvite({
      userId: result.user.id,
      inviteId: result.invite.id,
      username: result.user.username,
    });

    return result.user;
  }
}
