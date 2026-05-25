import type { UserRepository } from "../interfaces/user.repository.interface";
import type { IAuthCache } from "../interfaces/auth-cache.interface";

interface Dependencies {
  userRepository: UserRepository;
  authCache: IAuthCache;
}

export class UnsuspendUserUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(params: { userId: string }) {
    const user = await this.deps.userRepository.findById(params.userId);

    if (!user) {
      throw new Error("User not found");
    }

    if (user.status !== "SUSPENDED") {
      throw new Error("User is not suspended");
    }

    await this.deps.userRepository.unsuspend(params.userId);

    await this.deps.authCache.invalidate(params.userId);
  }
}
