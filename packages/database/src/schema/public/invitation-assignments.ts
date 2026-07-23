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
import { sectors } from "./sectors";
import { territories } from "./territories";

/**
 * Per-sector slice of a pending invite (manager for REP, territories listed
 * separately in invitation_territory_assignments).
 */
export const invitationSectorAssignments = pgTable(
  "invitation_sector_assignments",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    invitationId: text("invitation_id")
      .notNull()
      .references(() => invitations.id, { onDelete: "cascade" }),
    sectorId: text("sector_id")
      .notNull()
      .references(() => sectors.id, { onDelete: "cascade" }),
    managerId: text("manager_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("invitation_sector_assignments_invitation_id_sector_id_uidx").on(
      t.invitationId,
      t.sectorId,
    ),
    index("invitation_sector_assignments_invitation_id_idx").on(t.invitationId),
    index("invitation_sector_assignments_sector_id_idx").on(t.sectorId),
    index("invitation_sector_assignments_manager_id_idx").on(t.managerId),
  ],
);

/** Territories staged on an invite, scoped to a healthcare sector. */
export const invitationTerritoryAssignments = pgTable(
  "invitation_territory_assignments",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    invitationId: text("invitation_id")
      .notNull()
      .references(() => invitations.id, { onDelete: "cascade" }),
    sectorId: text("sector_id")
      .notNull()
      .references(() => sectors.id, { onDelete: "cascade" }),
    territoryId: text("territory_id")
      .notNull()
      .references(() => territories.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex(
      "invitation_territory_assignments_invitation_id_territory_id_uidx",
    ).on(t.invitationId, t.territoryId),
    index("invitation_territory_assignments_invitation_id_idx").on(
      t.invitationId,
    ),
    index("invitation_territory_assignments_sector_id_idx").on(t.sectorId),
    index("invitation_territory_assignments_territory_id_idx").on(t.territoryId),
  ],
);

export const invitationSectorAssignmentsRelations = relations(
  invitationSectorAssignments,
  ({ one }) => ({
    invitation: one(invitations, {
      fields: [invitationSectorAssignments.invitationId],
      references: [invitations.id],
    }),
    sector: one(sectors, {
      fields: [invitationSectorAssignments.sectorId],
      references: [sectors.id],
    }),
    manager: one(users, {
      fields: [invitationSectorAssignments.managerId],
      references: [users.id],
    }),
  }),
);

export const invitationTerritoryAssignmentsRelations = relations(
  invitationTerritoryAssignments,
  ({ one }) => ({
    invitation: one(invitations, {
      fields: [invitationTerritoryAssignments.invitationId],
      references: [invitations.id],
    }),
    sector: one(sectors, {
      fields: [invitationTerritoryAssignments.sectorId],
      references: [sectors.id],
    }),
    territory: one(territories, {
      fields: [invitationTerritoryAssignments.territoryId],
      references: [territories.id],
    }),
  }),
);
