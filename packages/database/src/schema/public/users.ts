import {
  pgTable,
  text,
  boolean,
  timestamp,
  integer,
  json,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import {
  userStatusEnum,
  authSessionDeviceTypeEnum,
  authSessionTypeEnum,
  verificationTokenTypeEnum,
  invitationStatusEnum,
} from "./enums";

export const roles = pgTable(
  "roles",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    name: text("name").notNull().unique(),
    description: text("description"),
    priority: integer("priority").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("roles_priority_idx").on(t.priority)]
);

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    email: text("email").notNull().unique(),
    username: text("username").notNull().unique(),
    phoneNumber: text("phone_number").unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    phoneVerified: boolean("phone_verified").notNull().default(false),
    emailVerifiedAt: timestamp("email_verified_at"),
    phoneVerifiedAt: timestamp("phone_verified_at"),
    passwordHash: text("password_hash").notNull(),
    passwordHistory: text("password_history").array().notNull().default([]),
    firstName: text("first_name"),
    lastName: text("last_name"),
    /** Optional profile birth date (admin/mobile user edit). */
    birthDate: timestamp("birth_date"),
    avatarUrl: text("avatar_url"),
    status: userStatusEnum("status").notNull().default("PENDING"),
    tokenVersion: integer("token_version").notNull().default(1),
    lastLoginAt: timestamp("last_login_at"),
    passwordChangedAt: timestamp("password_changed_at"),
    deactivatedAt: timestamp("deactivated_at"),
    suspendedAt: timestamp("suspended_at"),
    twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
    twoFactorSecret: text("two_factor_secret"),
    deletedAt: timestamp("deleted_at"),
    metadata: json("metadata"),
    roleId: text("role_id").notNull().references(() => roles.id),
    managerId: text("manager_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("users_email_idx").on(t.email),
    index("users_username_idx").on(t.username),
    index("users_phone_number_idx").on(t.phoneNumber),
    index("users_status_idx").on(t.status),
    index("users_deleted_at_idx").on(t.deletedAt),
    index("users_manager_id_idx").on(t.managerId),
  ]
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    refreshTokenHash: text("refresh_token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    revokedAt: timestamp("revoked_at"),
    revokedReason: text("revoked_reason"),
    revokedByUserId: text("revoked_by_user_id"),
    replacedBySessionId: text("replaced_by_session_id"),
    previousRefreshTokenHash: text("previous_refresh_token_hash"),
    lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
    userAgent: text("user_agent"),
    browserName: text("browser_name"),
    browserVersion: text("browser_version"),
    osName: text("os_name"),
    deviceType: authSessionDeviceTypeEnum("device_type").notNull().default("UNKNOWN"),
    deviceName: text("device_name"),
    deviceFingerprint: text("device_fingerprint"),
    sessionType: authSessionTypeEnum("session_type").notNull().default("WEB"),
    ipAddress: text("ip_address"),
    ipCountry: text("ip_country"),
    ipCity: text("ip_city"),
    suspiciousActivity: boolean("suspicious_activity").notNull().default(false),
    lastIpAddress: text("last_ip_address"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("sessions_user_id_idx").on(t.userId),
    index("sessions_refresh_token_hash_idx").on(t.refreshTokenHash),
    index("sessions_previous_refresh_token_hash_idx").on(t.previousRefreshTokenHash),
    index("sessions_expires_at_idx").on(t.expiresAt),
    index("sessions_revoked_at_idx").on(t.revokedAt),
    index("sessions_session_type_idx").on(t.sessionType),
    index("sessions_device_fingerprint_idx").on(t.deviceFingerprint),
    index("sessions_suspicious_activity_idx").on(t.suspiciousActivity),
  ]
);

export const passwordResets = pgTable(
  "password_resets",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("password_resets_user_id_idx").on(t.userId),
    index("password_resets_token_hash_idx").on(t.tokenHash),
    index("password_resets_expires_at_idx").on(t.expiresAt),
  ]
);

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: verificationTokenTypeEnum("type").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    newValue: text("new_value"),
    expiresAt: timestamp("expires_at").notNull(),
    verifiedAt: timestamp("verified_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("verification_tokens_user_id_idx").on(t.userId),
    index("verification_tokens_token_hash_idx").on(t.tokenHash),
    index("verification_tokens_type_idx").on(t.type),
    index("verification_tokens_expires_at_idx").on(t.expiresAt),
  ]
);

export const invitations = pgTable(
  "invitations",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    email: text("email"),
    phoneNumber: text("phone_number"),
    tokenHash: text("token_hash").notNull().unique(),
    status: invitationStatusEnum("status").notNull().default("PENDING"),
    expiresAt: timestamp("expires_at").notNull(),
    acceptedAt: timestamp("accepted_at"),
    acceptedByUserId: text("accepted_by_user_id"),
    revokedAt: timestamp("revoked_at"),
    resendCount: integer("resend_count").notNull().default(0),
    lastResendAt: timestamp("last_resend_at"),
    roleId: text("role_id").notNull().references(() => roles.id),
    invitedByUserId: text("invited_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    firstName: text("first_name"),
    lastName: text("last_name"),
    birthDate: timestamp("birth_date"),
    managerId: text("manager_id").references(() => users.id, { onDelete: "set null" }),
    managerTerritoryId: text("manager_territory_id"),
    repTerritoryId: text("rep_territory_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("invitations_email_idx").on(t.email),
    index("invitations_phone_number_idx").on(t.phoneNumber),
    index("invitations_token_hash_idx").on(t.tokenHash),
    index("invitations_status_idx").on(t.status),
    index("invitations_accepted_by_user_id_idx").on(t.acceptedByUserId),
    index("invitations_invited_by_user_id_idx").on(t.invitedByUserId),
    index("invitations_manager_id_idx").on(t.managerId),
    index("invitations_manager_territory_id_idx").on(t.managerTerritoryId),
    index("invitations_rep_territory_id_idx").on(t.repTerritoryId),
  ]
);

export const permissions = pgTable(
  "permissions",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    resource: text("resource").notNull(),
    resourceId: text("resource_id"),
    action: text("action").notNull(),
    conditions: json("conditions"),
    grantedBy: text("granted_by").references(() => users.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("permissions_user_id_idx").on(t.userId),
    index("permissions_resource_resource_id_idx").on(t.resource, t.resourceId),
    index("permissions_user_id_resource_idx").on(t.userId, t.resource),
    index("permissions_expires_at_idx").on(t.expiresAt),
    uniqueIndex("permissions_user_id_resource_resource_id_action_uidx").on(
      t.userId,
      t.resource,
      t.resourceId,
      t.action
    ),
  ]
);

// --- Relations ---

export const rolesRelations = relations(roles, ({ many }) => ({
  users: many(users),
  invitations: many(invitations),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  role: one(roles, { fields: [users.roleId], references: [roles.id] }),
  manager: one(users, {
    fields: [users.managerId],
    references: [users.id],
    relationName: "UserManager",
  }),
  directReports: many(users, { relationName: "UserManager" }),
  sessions: many(sessions),
  passwordResets: many(passwordResets),
  verificationTokens: many(verificationTokens),
  sentInvitations: many(invitations, { relationName: "InvitedByUser" }),
  managerInvitations: many(invitations, { relationName: "InvitationManager" }),
  permissions: many(permissions),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const passwordResetsRelations = relations(passwordResets, ({ one }) => ({
  user: one(users, { fields: [passwordResets.userId], references: [users.id] }),
}));

export const verificationTokensRelations = relations(verificationTokens, ({ one }) => ({
  user: one(users, { fields: [verificationTokens.userId], references: [users.id] }),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  role: one(roles, { fields: [invitations.roleId], references: [roles.id] }),
  invitedBy: one(users, {
    fields: [invitations.invitedByUserId],
    references: [users.id],
    relationName: "InvitedByUser",
  }),
  manager: one(users, {
    fields: [invitations.managerId],
    references: [users.id],
    relationName: "InvitationManager",
  }),
}));

export const permissionsRelations = relations(permissions, ({ one }) => ({
  user: one(users, { fields: [permissions.userId], references: [users.id] }),
}));
