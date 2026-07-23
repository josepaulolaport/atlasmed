import {
  birthDatesMatch,
  namesFuzzyMatch,
  toDateOnlyString,
  validatePassword,
} from "@atlasmed/access";
import type { InviteRepository } from "../interfaces/invite.repository.interface";
import type { PasswordService } from "../services/password.service";
import { normalizeInviteCode } from "../../../../shared/utils/generate-invite-code";
import { hashToken } from "../../../../shared/utils/hash-token";
import type { IAuditLog } from "../interfaces/audit-log.interface";
import {
  InvalidInviteError,
  InvalidPasswordError,
  ValidationError,
} from "../../../../shared/errors";

interface Dependencies {
  inviteRepository: InviteRepository;
  passwordService: PasswordService;
  auditLog: IAuditLog;
}

interface AcceptInviteParams {
  token: string;
  email: string;
  phoneNumber?: string | undefined;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  birthDate: string;
}

export class AcceptInviteUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(params: AcceptInviteParams) {
    const passwordCheck = validatePassword(params.password);
    if (!passwordCheck.valid) {
      throw new InvalidPasswordError([...passwordCheck.errors]);
    }

    const tokenHash = hashToken(normalizeInviteCode(params.token));
    const invite = await this.deps.inviteRepository.findValidByTokenHash(tokenHash);
    if (!invite) {
      throw new InvalidInviteError();
    }

    const expectedName = [invite.firstName, invite.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();
    const providedName = `${params.firstName} ${params.lastName}`.trim();

    if (expectedName && !namesFuzzyMatch(expectedName, providedName)) {
      throw new ValidationError([
        {
          field: "firstName",
          message:
            "O nome informado não confere com o convite. Confirme nome e sobrenome.",
        },
      ]);
    }

    if (!birthDatesMatch(invite.birthDate, params.birthDate)) {
      throw new ValidationError([
        {
          field: "birthDate",
          message: "A data de nascimento não confere com o convite.",
        },
      ]);
    }

    const birthDate = new Date(`${toDateOnlyString(params.birthDate)}T00:00:00.000Z`);
    const passwordHash = await this.deps.passwordService.hash(params.password);

    const result = await this.deps.inviteRepository.acceptInviteTransaction({
      tokenHash,
      email: params.email,
      phoneNumber: params.phoneNumber,
      username: params.username,
      passwordHash,
      firstName: params.firstName.trim(),
      lastName: params.lastName.trim(),
      birthDate,
    });

    await this.deps.auditLog.logUserRegister({
      userId: result.user.id,
      username: result.user.username,
      email: result.user.email!,
    });

    await this.deps.auditLog.logAcceptInvite({
      userId: result.user.id,
      inviteId: result.invite.id,
      username: result.user.username,
    });

    return result.user;
  }
}
