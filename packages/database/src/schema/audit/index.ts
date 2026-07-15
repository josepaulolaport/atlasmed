import { createId } from '@paralleldrive/cuid2'
import { relations } from 'drizzle-orm'
import { index, json, pgSchema, text, timestamp } from 'drizzle-orm/pg-core'
import { users } from '../public/users'

export const auditSchema = pgSchema('audit')

export const auditEventSeverityEnum = auditSchema.enum('audit_event_severity', [
  'INFO',
  'WARNING',
  'CRITICAL'
])

export const auditLogs = auditSchema.table(
  'audit_logs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    eventType: text('event_type').notNull(),
    severity: auditEventSeverityEnum('severity').notNull().default('INFO'),
    actor: text('actor'),
    actorId: text('actor_id'),
    resource: text('resource'),
    resourceId: text('resource_id'),
    action: text('action').notNull(),
    details: json('details'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    sessionId: text('session_id'),
    outcome: text('outcome'),
    errorMessage: text('error_message'),
    metadata: json('metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow()
  },
  (t) => [
    index('audit_logs_user_id_idx').on(t.userId),
    index('audit_logs_event_type_idx').on(t.eventType),
    index('audit_logs_severity_idx').on(t.severity),
    index('audit_logs_created_at_idx').on(t.createdAt),
    index('audit_logs_actor_id_idx').on(t.actorId),
    index('audit_logs_resource_id_idx').on(t.resourceId),
    index('audit_logs_session_id_idx').on(t.sessionId)
  ]
)

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, { fields: [auditLogs.userId], references: [users.id] })
}))
