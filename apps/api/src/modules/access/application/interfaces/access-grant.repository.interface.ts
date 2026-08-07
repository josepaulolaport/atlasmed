import type { AccessGrantRecord } from "@atlasmed/access";

export interface AccessGrantRepository {
  findActiveByUserId(userId: number): Promise<AccessGrantRecord[]>;

  create(params: {
    userId: number;
    resource: string;
    resourceId?: string;
    action: string;
    conditions?: Record<string, unknown>;
    grantedBy: number;
    expiresAt?: Date;
  }): Promise<AccessGrantRecord>;

  deleteMany(params: {
    userId: number;
    resource: string;
    resourceId?: string;
    action: string;
  }): Promise<number>;

  deleteExpired(): Promise<number>;
}
