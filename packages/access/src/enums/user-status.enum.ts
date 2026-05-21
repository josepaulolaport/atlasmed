// src/enums/user-status.enum.ts
export const UserStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  SUSPENDED: "SUSPENDED",
  PENDING: "PENDING",
} as const;

export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];
