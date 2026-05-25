import type { EmailService } from "../interfaces/email.service.interface";
import type { MessagingService } from "../interfaces/messaging.service.interface";
import type { InviteRepository } from "../interfaces/invite.repository.interface";
import type { UserRepository } from "../interfaces/user.repository.interface";
import { InviteService } from "../services/invite.service";

interface Dependencies {
  inviteRepository: InviteRepository;
  userRepository: UserRepository;
  emailService?: EmailService;
  messagingService?: MessagingService;
}

interface InviteUserParams {
  email?: string | undefined;
  phoneNumber?: string | undefined;
  roleId: string;
  invitedByUserId: string;
}

export class InviteUserUseCase {
  private readonly inviteService: InviteService;

  constructor(private readonly deps: Dependencies) {
    this.inviteService = new InviteService({ inviteRepository: deps.inviteRepository });
  }

  async execute(params: InviteUserParams) {
    if (!params.email && !params.phoneNumber) {
      throw new Error("Either email or phone number is required");
    }

    const identifier = params.email || params.phoneNumber!;
    const existingUser = await this.deps.userRepository.findByIdentifier({ identifier });

    if (existingUser) {
      throw new Error("User already exists");
    }

    const existingInvite = await this.deps.inviteRepository.findByEmailOrPhone(
      params.email || undefined,
      params.phoneNumber || undefined
    );

    if (existingInvite) {
      throw new Error("An active invite already exists for this user");
    }

    const { invite, token } = await this.inviteService.createInvite({
      email: params.email || undefined,
      phoneNumber: params.phoneNumber || undefined,
      roleId: params.roleId,
      invitedByUserId: params.invitedByUserId,
    });

    return {
      invite,
      token,
    };
  }
}
