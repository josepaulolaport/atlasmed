import type { UserRepository } from "../interfaces/user.repository.interface";
import type { SessionRepository } from "../interfaces/session.repository.interface";
import type { IAuthCache } from "../interfaces/auth-cache.interface";
import type { ISessionCache } from "../interfaces/session-cache.interface";
import { SessionService } from "../services/session.service";

interface Dependencies {
  userRepository: UserRepository;
  sessionRepository: SessionRepository;
  authCache: IAuthCache;
  sessionCache: ISessionCache;
}

export class DeactivateUserUseCase {
  private readonly sessionService: SessionService;

  constructor(private readonly deps: Dependencies) {
    this.sessionService = new SessionService({
      sessionRepository: deps.sessionRepository,
      sessionCache: deps.sessionCache,
    });
  }

  async execute(params: { userId: string }) {
    const user = await this.deps.userRepository.findById(params.userId);

    if (!user) {
      throw new Error("User not found");
    }

    if (user.status === "INACTIVE") {
      throw new Error("User is already deactivated");
    }

    await this.deps.userRepository.deactivate(params.userId);

    await this.sessionService.revokeAllByUserId(params.userId);

    await this.deps.authCache.invalidate(params.userId);
  }
}
