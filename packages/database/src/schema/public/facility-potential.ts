import {
  pgTable,
  text,
  timestamp,
  numeric,
  index,
  uniqueIndex,
  unique,
  bigint,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { businessVerticals } from "./business-verticals";
import { facilities } from "./facilities";
import { products } from "./catalog";
import { users } from "./users";

/**
 * Admin-defined potential metric fields per commercial Linha (vertical).
 * Soft-deleted via deleted_at — unique (vertical_id, key) among active rows.
 */
export const productPotentialDefinitions = pgTable(
  "product_potential_definitions",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    verticalId: bigint("vertical_id", { mode: "number" })
      .notNull().references(() => businessVerticals.id, { onDelete: "cascade" }),
    /** Stable key, e.g. ampolas_mes, prp. */
    key: text("key").notNull(),
    label: text("label").notNull(),
    sortOrder: bigint("sort_order", { mode: "number" }).notNull().default(0),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("product_potential_definitions_vertical_id_idx").on(t.verticalId),
    uniqueIndex("product_potential_definitions_vertical_key_active_uidx")
      .on(t.verticalId, t.key)
      .where(sql`${t.deletedAt} is null`),
  ],
);

/** Monthly potential quantity entered by REP/admin for a facility + definition. */
export const facilityPotentialValues = pgTable(
  "facility_potential_values",
  {
    facilityId: bigint("facility_id", { mode: "number" })
      .notNull().references(() => facilities.id, { onDelete: "cascade" }),
    definitionId: bigint("definition_id", { mode: "number" })
      .notNull().references(() => productPotentialDefinitions.id, { onDelete: "cascade" }),
    quantity: numeric("quantity", { precision: 14, scale: 2 }).notNull(),
    updatedByUserId: bigint("updated_by_user_id", { mode: "number" }).references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    unique("facility_potential_values_pk").on(t.facilityId, t.definitionId),
    index("facility_potential_values_facility_id_idx").on(t.facilityId),
    index("facility_potential_values_definition_id_idx").on(t.definitionId),
  ],
);

/**
 * Maps a product to exactly one potential metric definition (1:1).
 * Product must belong to the same Linha as the definition.
 */
export const productPotentialLinks = pgTable(
  "product_potential_links",
  {
    productId: bigint("product_id", { mode: "number" })
      .primaryKey().references(() => products.id, { onDelete: "cascade" }),
    definitionId: bigint("definition_id", { mode: "number" })
      .notNull().references(() => productPotentialDefinitions.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("product_potential_links_definition_id_idx").on(t.definitionId),
  ],
);

export const productPotentialDefinitionsRelations = relations(
  productPotentialDefinitions,
  ({ one, many }) => ({
    vertical: one(businessVerticals, {
      fields: [productPotentialDefinitions.verticalId],
      references: [businessVerticals.id],
    }),
    facilityValues: many(facilityPotentialValues),
    productLinks: many(productPotentialLinks),
  }),
);

export const facilityPotentialValuesRelations = relations(
  facilityPotentialValues,
  ({ one }) => ({
    facility: one(facilities, {
      fields: [facilityPotentialValues.facilityId],
      references: [facilities.id],
    }),
    definition: one(productPotentialDefinitions, {
      fields: [facilityPotentialValues.definitionId],
      references: [productPotentialDefinitions.id],
    }),
    updatedBy: one(users, {
      fields: [facilityPotentialValues.updatedByUserId],
      references: [users.id],
    }),
  }),
);

export const productPotentialLinksRelations = relations(
  productPotentialLinks,
  ({ one }) => ({
    product: one(products, {
      fields: [productPotentialLinks.productId],
      references: [products.id],
    }),
    definition: one(productPotentialDefinitions, {
      fields: [productPotentialLinks.definitionId],
      references: [productPotentialDefinitions.id],
    }),
  }),
);
