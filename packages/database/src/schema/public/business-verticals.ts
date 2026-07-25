import {
  pgTable,
  text,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { users } from "./users";

/** Commercial business vertical (e.g. Ortopedia, Dermatologia). Not a medical specialty. */
export const businessVerticals = pgTable(
  "business_verticals",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    /** Stable integration key, e.g. ORTOPEDIA. */
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("business_verticals_is_active_idx").on(t.isActive)]
);

/** Which business verticals a manager, REP, or OPS operates in. */
export const userVerticalAssignments = pgTable(
  "user_vertical_assignments",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    verticalId: text("vertical_id")
      .notNull()
      .references(() => businessVerticals.id, { onDelete: "cascade" }),
    /** Reporting manager for this vertical (REP). Null for managers/admin/ops. */
    managerId: text("manager_id").references(() => users.id, {
      onDelete: "set null",
    }),
    assignedByUserId: text("assigned_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("user_vertical_assignments_user_id_vertical_id_uidx").on(
      t.userId,
      t.verticalId
    ),
    index("user_vertical_assignments_user_id_idx").on(t.userId),
    index("user_vertical_assignments_vertical_id_idx").on(t.verticalId),
    index("user_vertical_assignments_manager_id_idx").on(t.managerId),
  ]
);

export const businessVerticalsRelations = relations(
  businessVerticals,
  ({ many }) => ({
    userAssignments: many(userVerticalAssignments),
  })
);

export const userVerticalAssignmentsRelations = relations(
  userVerticalAssignments,
  ({ one }) => ({
    user: one(users, {
      fields: [userVerticalAssignments.userId],
      references: [users.id],
    }),
    vertical: one(businessVerticals, {
      fields: [userVerticalAssignments.verticalId],
      references: [businessVerticals.id],
    }),
    manager: one(users, {
      fields: [userVerticalAssignments.managerId],
      references: [users.id],
      relationName: "UserVerticalManager",
    }),
    assignedBy: one(users, {
      fields: [userVerticalAssignments.assignedByUserId],
      references: [users.id],
      relationName: "UserVerticalAssignedBy",
    }),
  })
);
