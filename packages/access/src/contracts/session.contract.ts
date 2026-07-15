import type {
  AuthSessionDeviceType as DeviceType,
  AuthSessionType as SessionType
} from '@atlasmed/database'

export interface SessionContract {
  id: string

  userId: string

  sessionType: SessionType

  deviceType: DeviceType

  ipAddress?: string

  userAgent?: string

  browserName?: string

  browserVersion?: string

  osName?: string

  expiresAt: Date

  revokedAt?: Date

  createdAt: Date

  updatedAt: Date
}
