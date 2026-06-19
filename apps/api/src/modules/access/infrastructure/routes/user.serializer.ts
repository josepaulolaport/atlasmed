export function serializeAuthUser(user: {
  id: string;
  email: string;
  username: string;
  firstName?: string | null;
  lastName?: string | null;
  status: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  role: {
    id: string;
    name: string;
    description?: string | null;
  };
}) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    firstName: user.firstName ?? undefined,
    lastName: user.lastName ?? undefined,
    status: user.status,
    emailVerified: user.emailVerified,
    phoneVerified: user.phoneVerified,
    role: {
      id: user.role.id,
      name: user.role.name,
      description: user.role.description ?? undefined,
    },
  };
}

export function serializeUser(user: {
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
  twoFactorEnabled?: boolean;
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
    twoFactorEnabled: user.twoFactorEnabled ?? false,
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
