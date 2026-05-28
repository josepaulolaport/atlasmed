import type { UserRepository } from "../interfaces/user.repository.interface";
import type { AccessGrantService } from "../services/access-grant.service";
import { defineAbilitiesForUser, type Role } from "@atlasmed/access";
import { UserNotFoundError } from "../../../../shared/errors";

interface Dependencies {
  userRepository: UserRepository;
  accessGrantService: AccessGrantService;
}

export class GetCapabilitiesUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(params: { userId: string }) {
    const user = await this.deps.userRepository.findById(params.userId);

    if (!user) {
      throw new UserNotFoundError(params.userId);
    }

    const grants = await this.deps.accessGrantService.getActiveGrants(params.userId);
    const role = user.role.name as Role;

    defineAbilitiesForUser(role, grants);

    return {
      role,
      grants,
    };
  }
}
