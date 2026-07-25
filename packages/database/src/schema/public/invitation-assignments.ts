import {
  pgTable,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { invitations, users } from "./users";
import { businessVerticals } from "./business-verticals";
import { territories } from "./territories";

/**
 * Per-vertical slice of a pending invite (manager for REP, territories listed
 * separately in invitation_territory_assignments).
 */
export const invitationVerticalAssignments = pgTable(
  "invitation_vertical_assignments",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    invitationId: text("invitation_id")
      .notNull()
      .references(() => invitations.id, { onDelete: "cascade" }),
    verticalId: text("vertical_id")
      .notNull()
      .references(() => businessVerticals.id, { onDelete: "cascade" }),
    managerId: text("manager_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("invitation_vertical_assignments_invitation_id_vertical_id_uidx").on(
      t.invitationId,
      t.verticalId
    ),
    index("invitation_vertical_assignments_invitation_id_idx").on(t.invitationId),
    index("invitation_vertical_assignments_vertical_id_idx").on(t.verticalId),
    index("invitation_vertical_assignments_manager_id_idx").on(t.managerId),
  ]
);

/** Territories staged on an invite, scoped to a business vertical. */
export const invitationTerritoryAssignments = pgTable(
  "invitation_territory_assignments",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    invitationId: text("invitation_id")
      .notNull()
      .references(() => invitations.id, { onDelete: "cascade" }),
    verticalId: text("vertical_id")
      .notNull()
      .references(() => businessVerticals.id, { onDelete: "cascade" }),
    territoryId: text("territory_id")
      .notNull()
      .references(() => territories.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex(
      "invitation_territory_assignments_invitation_id_territory_id_uidx"
    ).on(t.invitationId, t.territoryId),
    index("invitation_territory_assignments_invitation_id_idx").on(
      t.invitationId
    ),
    index("invitation_territory_assignments_vertical_id_idx").on(t.verticalId),
    index("invitation_territory_assignments_territory_id_idx").on(t.territoryId),
  ]
);

export const invitationVerticalAssignmentsRelations = relations(
  invitationVerticalAssignments,
  ({ one }) => ({
    invitation: one(invitations, {
      fields: [invitationVerticalAssignments.invitationId],
      references: [invitations.id],
    }),
    vertical: one(businessVerticals, {
      fields: [invitationVerticalAssignments.verticalId],
      references: [businessVerticals.id],
    }),
    manager: one(users, {
      fields: [invitationVerticalAssignments.managerId],
      references: [users.id],
    }),
  })
);

export const invitationTerritoryAssignmentsRelations = relations(
  invitationTerritoryAssignments,
  ({ one }) => ({
    invitation: one(invitations, {
      fields: [invitationTerritoryAssignments.invitationId],
      references: [invitations.id],
    }),
    vertical: one(businessVerticals, {
      fields: [invitationTerritoryAssignments.verticalId],
      references: [businessVerticals.id],
    }),
    territory: one(territories, {
      fields: [invitationTerritoryAssignments.territoryId],
      references: [territories.id],
    }),
  })
);
