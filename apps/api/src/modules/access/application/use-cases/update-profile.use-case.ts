import type { UserRepository } from "../interfaces/user.repository.interface";
import type { IAuthCache } from "../interfaces/auth-cache.interface";
import { UserNotFoundError, ValidationError } from "../../../../shared/errors";

interface UpdateProfileInput {
  userId: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
}

interface UpdateProfileDependencies {
  userRepository: UserRepository;
  authCache: IAuthCache;
}

export class UpdateProfileUseCase {
  constructor(private readonly dependencies: UpdateProfileDependencies) {}

  async execute(input: UpdateProfileInput) {
    const { userId, firstName, lastName, avatarUrl } = input;

    const hasUpdates =
      firstName !== undefined ||
      lastName !== undefined ||
      avatarUrl !== undefined;

    if (!hasUpdates) {
      throw new ValidationError([
        { field: "body", message: "At least one field must be provided" },
      ]);
    }

    const user = await this.dependencies.userRepository.findById(userId);

    if (!user) {
      throw new UserNotFoundError(userId);
    }

    const updatedUser = await this.dependencies.userRepository.updateProfile(
      userId,
      { firstName, lastName, avatarUrl }
    );

    await this.dependencies.authCache.invalidate(userId);

    return updatedUser;
  }
}
