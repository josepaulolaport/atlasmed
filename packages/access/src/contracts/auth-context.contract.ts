import type { InviteStatus } from "../enums/invite-status.enum";

import type { RoleContract } from "./role.contract";

export interface InviteContract {
  id: string;

  email?: string;

  phoneNumber?: string;

  status: InviteStatus;

  role: RoleContract;

  expiresAt: Date;

  acceptedAt?: Date;

  revokedAt?: Date;

  createdAt: Date;

  updatedAt: Date;
}
