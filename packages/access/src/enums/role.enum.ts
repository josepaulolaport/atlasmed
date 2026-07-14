// src/enums/user-status.enum.ts
export const Role = {
  ADMIN: "ADMIN",
  MANAGER: "MANAGER",
  REP: "REP",
  OPS: "OPS",
} as const;

export type Role = (typeof Role)[keyof typeof Role];
