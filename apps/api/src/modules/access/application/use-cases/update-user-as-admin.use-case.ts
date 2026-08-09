import { Role } from "@atlasmed/access";
import type {
  UserRepository,
  UpdateUserAsAdminParams,
} from "../interfaces/user.repository.interface";
import type { IAuthCache } from "../interfaces/auth-cache.interface";
import {
  InsufficientPermissionsError,
  ResourceConflictError,
  UserNotFoundError,
  ValidationError,
} from "../../../../shared/errors";
import { serializeUser } from "./list-users.use-case";

interface Dependencies {
  userRepository: UserRepository;
  authCache: IAuthCache;
}

export class UpdateUserAsAdminUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(params: {
    targetUserId: number;
    actorRole: Role;
    data: UpdateUserAsAdminParams;
  }) {
    if (params.actorRole !== Role.ADMIN) {
      throw new InsufficientPermissionsError(
        ["user:manage"],
        [`role:${params.actorRole}`],
      );
    }

    const {
      firstName,
      lastName,
      email,
      phoneNumber,
      username,
      birthDate,
    } = params.data;

    const hasUpdates =
      firstName !== undefined ||
      lastName !== undefined ||
      email !== undefined ||
      phoneNumber !== undefined ||
      username !== undefined ||
      birthDate !== undefined;

    if (!hasUpdates) {
      throw new ValidationError([
        { field: "body", message: "At least one field must be provided" },
      ]);
    }

    const user = await this.deps.userRepository.findById(params.targetUserId);
    if (!user) {
      throw new UserNotFoundError(params.targetUserId);
    }

    if (email !== undefined && email !== user.email) {
      const existing = await this.deps.userRepository.findByEmail(email);
      if (existing && existing.id !== user.id) {
        throw new ResourceConflictError("User", "Email already in use");
      }
    }

    if (username !== undefined && username !== user.username) {
      const existing = await this.deps.userRepository.findByUsername(username);
      if (existing && existing.id !== user.id) {
        throw new ResourceConflictError("User", "Username already in use");
      }
    }

    if (
      phoneNumber !== undefined &&
      phoneNumber !== null &&
      phoneNumber !== user.phoneNumber
    ) {
      const existing = await this.deps.userRepository.findByPhone(phoneNumber);
      if (existing && existing.id !== user.id) {
        throw new ResourceConflictError("User", "Phone number already in use");
      }
    }

    const updated = await this.deps.userRepository.updateAsAdmin(
      params.targetUserId,
      {
        firstName,
        lastName,
        email,
        phoneNumber,
        username,
        birthDate,
      },
    );

    await this.deps.authCache.invalidate(params.targetUserId);

    return serializeUser(updated);
  }
}
