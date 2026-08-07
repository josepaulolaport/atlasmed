import {
  pgTable,
  text,
  boolean,
  timestamp,
  index,
  uniqueIndex,
  integer,
  bigint,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";

/** Commercial business vertical (e.g. Ortopédica, Estética). Not a medical specialty. */
export const businessVerticals = pgTable(
  "business_verticals",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
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
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    userId: bigint("user_id", { mode: "number" })
      .notNull().references(() => users.id, { onDelete: "cascade" }),
    verticalId: bigint("vertical_id", { mode: "number" })
      .notNull().references(() => businessVerticals.id, { onDelete: "cascade" }),
    assignedByUserId: bigint("assigned_by_user_id", { mode: "number" }).references(() => users.id, {
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
    assignedBy: one(users, {
      fields: [userVerticalAssignments.assignedByUserId],
      references: [users.id],
      relationName: "UserVerticalAssignedBy",
    }),
  })
);
