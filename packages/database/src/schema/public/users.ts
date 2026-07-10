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
  auditEventTypeEnum,
  auditEventSeverityEnum,
} from "./enums";

export const roles = pgTable(
  "roles",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    name: text("name").notNull().unique(),
    description: text("description"),
    priority: integer("priority").notNull().default(0),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => [index("roles_priority_idx").on(t.priority)]
);

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    email: text("email").notNull().unique(),
    username: text("username").notNull().unique(),
    phoneNumber: text("phoneNumber").unique(),
    emailVerified: boolean("emailVerified").notNull().default(false),
    phoneVerified: boolean("phoneVerified").notNull().default(false),
    emailVerifiedAt: timestamp("emailVerifiedAt"),
    phoneVerifiedAt: timestamp("phoneVerifiedAt"),
    passwordHash: text("passwordHash").notNull(),
    passwordHistory: text("passwordHistory").array().notNull().default([]),
    firstName: text("firstName"),
    lastName: text("lastName"),
    avatarUrl: text("avatarUrl"),
    status: userStatusEnum("status").notNull().default("PENDING"),
    tokenVersion: integer("tokenVersion").notNull().default(1),
    lastLoginAt: timestamp("lastLoginAt"),
    passwordChangedAt: timestamp("passwordChangedAt"),
    deactivatedAt: timestamp("deactivatedAt"),
    suspendedAt: timestamp("suspendedAt"),
    twoFactorEnabled: boolean("twoFactorEnabled").notNull().default(false),
    twoFactorSecret: text("twoFactorSecret"),
    deletedAt: timestamp("deletedAt"),
    metadata: json("metadata"),
    roleId: text("roleId").notNull().references(() => roles.id),
    managerId: text("managerId"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => [
    index("users_email_idx").on(t.email),
    index("users_username_idx").on(t.username),
    index("users_phoneNumber_idx").on(t.phoneNumber),
    index("users_status_idx").on(t.status),
    index("users_deletedAt_idx").on(t.deletedAt),
    index("users_managerId_idx").on(t.managerId),
  ]
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    refreshTokenHash: text("refreshTokenHash").notNull().unique(),
    expiresAt: timestamp("expiresAt").notNull(),
    revokedAt: timestamp("revokedAt"),
    revokedReason: text("revokedReason"),
    revokedByUserId: text("revokedByUserId"),
    replacedBySessionId: text("replacedBySessionId"),
    previousRefreshTokenHash: text("previousRefreshTokenHash"),
    lastSeenAt: timestamp("lastSeenAt").notNull().defaultNow(),
    userAgent: text("userAgent"),
    browserName: text("browserName"),
    browserVersion: text("browserVersion"),
    osName: text("osName"),
    deviceType: authSessionDeviceTypeEnum("deviceType").notNull().default("UNKNOWN"),
    deviceName: text("deviceName"),
    deviceFingerprint: text("deviceFingerprint"),
    sessionType: authSessionTypeEnum("sessionType").notNull().default("WEB"),
    ipAddress: text("ipAddress"),
    ipCountry: text("ipCountry"),
    ipCity: text("ipCity"),
    suspiciousActivity: boolean("suspiciousActivity").notNull().default(false),
    lastIpAddress: text("lastIpAddress"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => [
    index("sessions_userId_idx").on(t.userId),
    index("sessions_refreshTokenHash_idx").on(t.refreshTokenHash),
    index("sessions_previousRefreshTokenHash_idx").on(t.previousRefreshTokenHash),
    index("sessions_expiresAt_idx").on(t.expiresAt),
    index("sessions_revokedAt_idx").on(t.revokedAt),
    index("sessions_sessionType_idx").on(t.sessionType),
    index("sessions_deviceFingerprint_idx").on(t.deviceFingerprint),
    index("sessions_suspiciousActivity_idx").on(t.suspiciousActivity),
  ]
);

export const passwordResets = pgTable(
  "password_resets",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("tokenHash").notNull().unique(),
    expiresAt: timestamp("expiresAt").notNull(),
    usedAt: timestamp("usedAt"),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => [
    index("password_resets_userId_idx").on(t.userId),
    index("password_resets_tokenHash_idx").on(t.tokenHash),
    index("password_resets_expiresAt_idx").on(t.expiresAt),
  ]
);

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: verificationTokenTypeEnum("type").notNull(),
    tokenHash: text("tokenHash").notNull().unique(),
    newValue: text("newValue"),
    expiresAt: timestamp("expiresAt").notNull(),
    verifiedAt: timestamp("verifiedAt"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => [
    index("verification_tokens_userId_idx").on(t.userId),
    index("verification_tokens_tokenHash_idx").on(t.tokenHash),
    index("verification_tokens_type_idx").on(t.type),
    index("verification_tokens_expiresAt_idx").on(t.expiresAt),
  ]
);

export const invitations = pgTable(
  "invitations",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    email: text("email"),
    phoneNumber: text("phoneNumber"),
    tokenHash: text("tokenHash").notNull().unique(),
    status: invitationStatusEnum("status").notNull().default("PENDING"),
    expiresAt: timestamp("expiresAt").notNull(),
    acceptedAt: timestamp("acceptedAt"),
    acceptedByUserId: text("acceptedByUserId"),
    revokedAt: timestamp("revokedAt"),
    resendCount: integer("resendCount").notNull().default(0),
    lastResendAt: timestamp("lastResendAt"),
    roleId: text("roleId").notNull().references(() => roles.id),
    invitedByUserId: text("invitedByUserId").notNull().references(() => users.id, { onDelete: "restrict" }),
    firstName: text("firstName"),
    lastName: text("lastName"),
    managerId: text("managerId").references(() => users.id, { onDelete: "set null" }),
    managerTerritoryId: text("managerTerritoryId"),
    repTerritoryId: text("repTerritoryId"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => [
    index("invitations_email_idx").on(t.email),
    index("invitations_phoneNumber_idx").on(t.phoneNumber),
    index("invitations_tokenHash_idx").on(t.tokenHash),
    index("invitations_status_idx").on(t.status),
    index("invitations_acceptedByUserId_idx").on(t.acceptedByUserId),
    index("invitations_invitedByUserId_idx").on(t.invitedByUserId),
    index("invitations_managerId_idx").on(t.managerId),
    index("invitations_managerTerritoryId_idx").on(t.managerTerritoryId),
    index("invitations_repTerritoryId_idx").on(t.repTerritoryId),
  ]
);

export const permissions = pgTable(
  "permissions",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    resource: text("resource").notNull(),
    resourceId: text("resourceId"),
    action: text("action").notNull(),
    conditions: json("conditions"),
    grantedBy: text("grantedBy"),
    expiresAt: timestamp("expiresAt"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => [
    index("permissions_userId_idx").on(t.userId),
    index("permissions_resource_resourceId_idx").on(t.resource, t.resourceId),
    index("permissions_userId_resource_idx").on(t.userId, t.resource),
    index("permissions_expiresAt_idx").on(t.expiresAt),
    uniqueIndex("permissions_userId_resource_resourceId_action_uidx").on(
      t.userId,
      t.resource,
      t.resourceId,
      t.action
    ),
  ]
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    userId: text("userId").references(() => users.id, { onDelete: "set null" }),
    eventType: auditEventTypeEnum("eventType").notNull(),
    severity: auditEventSeverityEnum("severity").notNull().default("INFO"),
    actor: text("actor"),
    actorId: text("actorId"),
    resource: text("resource"),
    resourceId: text("resourceId"),
    action: text("action").notNull(),
    details: json("details"),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    sessionId: text("sessionId"),
    outcome: text("outcome"),
    errorMessage: text("errorMessage"),
    metadata: json("metadata"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (t) => [
    index("audit_logs_userId_idx").on(t.userId),
    index("audit_logs_eventType_idx").on(t.eventType),
    index("audit_logs_severity_idx").on(t.severity),
    index("audit_logs_createdAt_idx").on(t.createdAt),
    index("audit_logs_actorId_idx").on(t.actorId),
    index("audit_logs_resourceId_idx").on(t.resourceId),
    index("audit_logs_sessionId_idx").on(t.sessionId),
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
  auditLogs: many(auditLogs),
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

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, { fields: [auditLogs.userId], references: [users.id] }),
}));
