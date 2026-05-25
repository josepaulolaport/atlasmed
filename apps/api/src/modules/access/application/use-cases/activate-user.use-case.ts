import type { UserRepository } from "../interfaces/user.repository.interface";
import type { IAuthCache } from "../interfaces/auth-cache.interface";

interface Dependencies {
  userRepository: UserRepository;
  authCache: IAuthCache;
}

export class ActivateUserUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(params: { userId: string }) {
    const user = await this.deps.userRepository.findById(params.userId);

    if (!user) {
      throw new Error("User not found");
    }

    if (user.status === "ACTIVE") {
      throw new Error("User is already active");
    }

    await this.deps.userRepository.activate(params.userId);

    await this.deps.authCache.invalidate(params.userId);
  }
}
