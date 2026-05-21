import type { SessionType } from "../enums/session-type.enum";

import type { DeviceType } from "../enums/device-type.enum";

export interface SessionContract {
  id: string;

  userId: string;

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
