import { Role } from "@atlasmed/access";
import type { UserRepository } from "../interfaces/user.repository.interface";
import { InsufficientPermissionsError, UserNotFoundError } from "../../../../shared/errors";
import { serializeUser } from "./list-users.use-case";

interface GetUserByIdDependencies {
  userRepository: UserRepository;
}

/**
 * Single-user lookup for admin tooling (e.g. resolving a territory's
 * assignee into a display-ready profile). `GET /access/users` only
 * supports paginated search — this is the singular counterpart.
 */
export class GetUserByIdUseCase {
  constructor(private readonly deps: GetUserByIdDependencies) {}

  async execute(params: { targetUserId: string; actorRole: Role }) {
    if (params.actorRole !== Role.ADMIN) {
      throw new InsufficientPermissionsError(["user:read"], [`role:${params.actorRole}`]);
    }

    const user = await this.deps.userRepository.findById(params.targetUserId);
    if (!user) {
      throw new UserNotFoundError(params.targetUserId);
    }

    return serializeUser(user);
  }
}
