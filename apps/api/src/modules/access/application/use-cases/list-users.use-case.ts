import type { ScopeContext } from "@atlasmed/access";
import type { UserRepository } from "../interfaces/user.repository.interface";

interface ListUsersInput {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  scope: ScopeContext;
}

interface ListUsersDependencies {
  userRepository: UserRepository;
}

function serializeUser(user: {
  id: string;
  email: string;
  username: string;
  phoneNumber?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  status: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  emailVerifiedAt?: Date | null;
  phoneVerifiedAt?: Date | null;
  role: {
    id: string;
    name: string;
    description?: string | null;
  };
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    phoneNumber: user.phoneNumber ?? undefined,
    firstName: user.firstName ?? undefined,
    lastName: user.lastName ?? undefined,
    avatarUrl: user.avatarUrl ?? undefined,
    status: user.status,
    emailVerified: user.emailVerified,
    phoneVerified: user.phoneVerified,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? undefined,
    phoneVerifiedAt: user.phoneVerifiedAt?.toISOString() ?? undefined,
    role: {
      id: user.role.id,
      name: user.role.name,
      description: user.role.description ?? undefined,
    },
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export class ListUsersUseCase {
  constructor(private readonly dependencies: ListUsersDependencies) {}

  async execute(input: ListUsersInput) {
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;

    const { users, total } = await this.dependencies.userRepository.findAll({
      page,
      limit,
      status: input.status,
      search: input.search,
      scope: input.scope.isGlobal
        ? { isGlobal: true, territoryIds: [] }
        : {
            isGlobal: false,
            territoryIds: input.scope.territoryIds,
            managedUserIds: input.scope.managedUserIds,
          },
    });

    return {
      data: users.map(serializeUser),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}
