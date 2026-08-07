import {
  pgTable,
  text,
  timestamp,
  index,
  uniqueIndex,
  integer,
  bigint,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { invitations } from "./users";
import { businessVerticals } from "./business-verticals";
import { territories } from "./territories";

/**
 * Per-vertical slice of a pending invite (manager for REP, territories listed
 * separately in invitation_territory_assignments).
 */
export const invitationVerticalAssignments = pgTable(
  "invitation_vertical_assignments",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    invitationId: bigint("invitation_id", { mode: "number" })
      .notNull().references(() => invitations.id, { onDelete: "cascade" }),
    verticalId: bigint("vertical_id", { mode: "number" })
      .notNull().references(() => businessVerticals.id, { onDelete: "cascade" }),
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
  ]
);

/** Territories staged on an invite, scoped to a business vertical. */
export const invitationTerritoryAssignments = pgTable(
  "invitation_territory_assignments",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    invitationId: bigint("invitation_id", { mode: "number" })
      .notNull().references(() => invitations.id, { onDelete: "cascade" }),
    verticalId: bigint("vertical_id", { mode: "number" })
      .notNull().references(() => businessVerticals.id, { onDelete: "cascade" }),
    territoryId: bigint("territory_id", { mode: "number" })
      .notNull().references(() => territories.id, { onDelete: "restrict" }),
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
