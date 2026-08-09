import type { AuthSessionType as SessionType, AuthSessionDeviceType as DeviceType } from "@atlasmed/database";

export interface SessionContract {
  id: number;

  userId: number;

  sessionType: SessionType;

  deviceType: DeviceType;

  ipAddress?: string;

  userAgent?: string;

  browserName?: string;

  browserVersion?: string;

  osName?: string;

  expiresAt: Date;

  revokedAt?: Date;

  createdAt: Date;

  updatedAt: Date;
}
