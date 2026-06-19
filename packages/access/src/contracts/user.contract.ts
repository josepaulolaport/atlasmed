import type { UserStatus } from "@atlasmed/database";

import type { RoleContract } from "./role.contract";

export interface UserContract {
  id: string;

  email?: string;

  username: string;

  phoneNumber?: string;

  firstName?: string;

  lastName?: string;

  avatarUrl?: string;

  status: UserStatus;

  role: RoleContract;

  emailVerified: boolean;

  phoneVerified: boolean;

  createdAt: Date;

  updatedAt: Date;
}
