import {
  pgTable,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  unique,
  bigint,
  inet,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
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
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    name: text("name").notNull().unique(),
    description: text("description"),
    priority: bigint("priority", { mode: "number" }).notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [index("roles_priority_idx").on(t.priority)]
);

export const users = pgTable(
  "users",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    email: text("email").notNull(),
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
    avatarBlurhash: text("avatar_blurhash"),
    status: userStatusEnum("status").notNull().default("PENDING"),
    tokenVersion: bigint("token_version", { mode: "number" }).notNull().default(1),
    lastLoginAt: timestamp("last_login_at"),
    passwordChangedAt: timestamp("password_changed_at"),
    deactivatedAt: timestamp("deactivated_at"),
    suspendedAt: timestamp("suspended_at"),
    twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
    twoFactorSecret: text("two_factor_secret"),
    deletedAt: timestamp("deleted_at"),
    metadata: jsonb("metadata"),
    roleId: bigint("role_id", { mode: "number" }).notNull().references(() => roles.id),
    /** Emultec `vendedor.Id` — manual map for order import seller resolve. */
    idVendedorEmultec: bigint("id_vendedor_emultec", { mode: "number" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("users_email_lower_uidx").on(sql`lower(${t.email})`),
    uniqueIndex("users_id_vendedor_emultec_uidx")
      .on(t.idVendedorEmultec)
      .where(sql`${t.idVendedorEmultec} IS NOT NULL`),
    index("users_status_idx").on(t.status),
    index("users_deleted_at_idx").on(t.deletedAt),
  ]
);

export const sessions = pgTable(
  "sessions",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    userId: bigint("user_id", { mode: "number" }).notNull().references(() => users.id, { onDelete: "cascade" }),
    refreshTokenHash: text("refresh_token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    revokedAt: timestamp("revoked_at"),
    revokedReason: text("revoked_reason"),
    revokedByUserId: bigint("revoked_by_user_id", { mode: "number" }),
    replacedBySessionId: bigint("replaced_by_session_id", { mode: "number" }),
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
    ipAddress: inet("ip_address"),
    ipCountry: text("ip_country"),
    ipCity: text("ip_city"),
    suspiciousActivity: boolean("suspicious_activity").notNull().default(false),
    lastIpAddress: inet("last_ip_address"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("sessions_user_id_idx").on(t.userId),
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
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    userId: bigint("user_id", { mode: "number" }).notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("password_resets_user_id_idx").on(t.userId),
    index("password_resets_expires_at_idx").on(t.expiresAt),
  ]
);

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    userId: bigint("user_id", { mode: "number" }).notNull().references(() => users.id, { onDelete: "cascade" }),
    type: verificationTokenTypeEnum("type").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    newValue: text("new_value"),
    expiresAt: timestamp("expires_at").notNull(),
    verifiedAt: timestamp("verified_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("verification_tokens_user_id_idx").on(t.userId),
    index("verification_tokens_type_idx").on(t.type),
    index("verification_tokens_expires_at_idx").on(t.expiresAt),
  ]
);

export const invitations = pgTable(
  "invitations",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    email: text("email"),
    phoneNumber: text("phone_number"),
    tokenHash: text("token_hash").notNull().unique(),
    status: invitationStatusEnum("status").notNull().default("PENDING"),
    expiresAt: timestamp("expires_at").notNull(),
    acceptedAt: timestamp("accepted_at"),
    acceptedByUserId: bigint("accepted_by_user_id", { mode: "number" }),
    revokedAt: timestamp("revoked_at"),
    resendCount: bigint("resend_count", { mode: "number" }).notNull().default(0),
    lastResendAt: timestamp("last_resend_at"),
    roleId: bigint("role_id", { mode: "number" }).notNull().references(() => roles.id),
    invitedByUserId: bigint("invited_by_user_id", { mode: "number" }).notNull().references(() => users.id, { onDelete: "restrict" }),
    firstName: text("first_name"),
    lastName: text("last_name"),
    birthDate: timestamp("birth_date"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("invitations_email_idx").on(t.email),
    index("invitations_phone_number_idx").on(t.phoneNumber),
    index("invitations_status_idx").on(t.status),
    /*
     * At most one live invitation per person.
     *
     * `InviteUserUseCase` looks for an existing PENDING invite and refuses if it
     * finds one, but check-then-insert is not atomic: two requests that overlap
     * both see nothing and both insert, and a double-tap on "Enviar convite" is
     * enough. The result is two invites with two working accept links for one
     * person — the second one dead-ends on the users unique index with a
     * conflict the invitee cannot act on.
     *
     * Partial, because the rule is about *live* invites: a revoked or expired
     * invitation must not block re-inviting, and an accepted one certainly must
     * not. `lower(email)` matches `users_email_lower_uidx`, so an invite cannot
     * be keyed differently from the user it creates — the application check is
     * case-sensitive today and would let `Joao@x.com` past a pending
     * `joao@x.com`.
     */
    uniqueIndex("invitations_pending_email_uidx")
      .on(sql`lower(${t.email})`)
      .where(sql`${t.status} = 'PENDING' AND ${t.email} IS NOT NULL`),
    uniqueIndex("invitations_pending_phone_number_uidx")
      .on(t.phoneNumber)
      .where(sql`${t.status} = 'PENDING' AND ${t.phoneNumber} IS NOT NULL`),
    index("invitations_accepted_by_user_id_idx").on(t.acceptedByUserId),
    index("invitations_invited_by_user_id_idx").on(t.invitedByUserId),
  ]
);

// --- Relations ---

export const rolesRelations = relations(roles, ({ many }) => ({
  users: many(users),
  invitations: many(invitations),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  role: one(roles, { fields: [users.roleId], references: [roles.id] }),
  sessions: many(sessions),
  passwordResets: many(passwordResets),
  verificationTokens: many(verificationTokens),
  sentInvitations: many(invitations, { relationName: "InvitedByUser" }),
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
}));
