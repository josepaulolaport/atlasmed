import { createId } from '@paralleldrive/cuid2'
import { relations } from 'drizzle-orm'
import { boolean, index, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { users } from './users'

/** Healthcare commercial vertical (e.g. oncology, cardiology). Not multi-tenant org. */
export const sectors = pgTable(
  'sectors',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow()
  },
  (t) => [index('sectors_is_active_idx').on(t.isActive)]
)

/** Which healthcare sectors a manager or rep operates in. Scope enforcement lands in Phase 3. */
export const userSectorAssignments = pgTable(
  'user_sector_assignments',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sectorId: text('sector_id')
      .notNull()
      .references(() => sectors.id, { onDelete: 'cascade' }),
    assignedByUserId: text('assigned_by_user_id').references(() => users.id, {
      onDelete: 'set null'
    }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow()
  },
  (t) => [
    uniqueIndex('user_sector_assignments_user_id_sector_id_uidx').on(t.userId, t.sectorId),
    index('user_sector_assignments_user_id_idx').on(t.userId),
    index('user_sector_assignments_sector_id_idx').on(t.sectorId)
  ]
)

export const sectorsRelations = relations(sectors, ({ many }) => ({
  userAssignments: many(userSectorAssignments)
}))

export const userSectorAssignmentsRelations = relations(userSectorAssignments, ({ one }) => ({
  user: one(users, { fields: [userSectorAssignments.userId], references: [users.id] }),
  sector: one(sectors, { fields: [userSectorAssignments.sectorId], references: [sectors.id] }),
  assignedBy: one(users, {
    fields: [userSectorAssignments.assignedByUserId],
    references: [users.id],
    relationName: 'UserSectorAssignedBy'
  })
}))
