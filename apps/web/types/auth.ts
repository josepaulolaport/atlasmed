export type UserStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING";
export type Role = "ADMIN" | "MANAGER" | "USER";
export type DeviceType = "DESKTOP" | "MOBILE" | "TABLET" | "UNKNOWN";
export type InviteStatus = "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";

export interface RoleInfo {
  id: string;
  name: string;
  description: string | null;
}

export interface User {
  id: string;
  username: string;
  email: string;
  phoneNumber?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  status: UserStatus;
  emailVerified: boolean;
  phoneVerified: boolean;
  twoFactorEnabled?: boolean;
  emailVerifiedAt?: string;
  phoneVerifiedAt?: string;
  role: {
    id: string;
    name: Role;
    description?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  deviceType: DeviceType;
  browserName?: string;
  browserVersion?: string;
  osName?: string;
  ipAddress?: string;
  lastSeenAt: string;
  createdAt: string;
  isCurrent: boolean;
  suspiciousActivity?: boolean;
}

export interface Invitation {
  id: string;
  email?: string;
  phoneNumber?: string;
  status: InviteStatus;
  role: {
    id: string;
    name: Role;
  };
  expiresAt: string;
  createdAt: string;
  acceptedAt?: string;
  revokedAt?: string;
  invitedBy?: {
    id: string;
    username: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface LoginResponse {
  session?: {
    token: string;
  };
  user?: User;
  requires2FA?: boolean;
  pendingToken?: string;
}

export interface RegisterRequest {
  token: string;
  email: string;
  phoneNumber?: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  session: {
    token: string;
  };
  user: User;
}

export interface PasswordResetRequest {
  identifier: string;
}

export interface PasswordResetConfirm {
  token: string;
  password: string;
}

export interface InviteUserRequest {
  email?: string;
  phoneNumber?: string;
  roleId: string;
}

export interface AccessGrant {
  id: string;
  resource: string;
  resourceId?: string;
  action: string;
  conditions?: Record<string, unknown>;
  expiresAt?: string;
}

export interface CapabilitiesResponse {
  role: string;
  grants: AccessGrant[];
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
}

export interface UserAssignmentManager {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

export interface UserTerritoryAssignment {
  territoryId: string;
  assignedAt: string;
}

export interface UserAssignments {
  userId: string;
  managerId: string | null;
  manager?: UserAssignmentManager | null;
  territories: UserTerritoryAssignment[];
  isOperationallyActive: boolean;
}
