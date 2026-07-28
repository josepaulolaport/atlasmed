import {
  pgTable,
  text,
  timestamp,
  integer,
  numeric,
  index,
  uniqueIndex,
  unique,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { businessVerticals } from "./business-verticals";
import { facilities } from "./facilities";
import { products } from "./catalog";
import { users } from "./users";

/**
 * Admin-defined potential metric fields per commercial Linha (vertical).
 * Soft-deleted via deleted_at — unique (vertical_id, key) among active rows.
 */
export const potentialMetricDefinitions = pgTable(
  "potential_metric_definitions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    verticalId: text("vertical_id")
      .notNull()
      .references(() => businessVerticals.id, { onDelete: "cascade" }),
    /** Stable key, e.g. ampolas_mes, prp. */
    key: text("key").notNull(),
    label: text("label").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("potential_metric_definitions_vertical_id_idx").on(t.verticalId),
    uniqueIndex("potential_metric_definitions_vertical_key_active_uidx")
      .on(t.verticalId, t.key)
      .where(sql`${t.deletedAt} is null`),
  ],
);

/** Monthly potential quantity entered by REP/admin for a facility + definition. */
export const facilityPotentialValues = pgTable(
  "facility_potential_values",
  {
    facilityId: text("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    definitionId: text("definition_id")
      .notNull()
      .references(() => potentialMetricDefinitions.id, { onDelete: "cascade" }),
    quantity: numeric("quantity", { precision: 14, scale: 2 }).notNull(),
    updatedByUserId: text("updated_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
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
    productId: text("product_id")
      .primaryKey()
      .references(() => products.id, { onDelete: "cascade" }),
    definitionId: text("definition_id")
      .notNull()
      .references(() => potentialMetricDefinitions.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("product_potential_links_definition_id_idx").on(t.definitionId),
  ],
);

export const potentialMetricDefinitionsRelations = relations(
  potentialMetricDefinitions,
  ({ one, many }) => ({
    vertical: one(businessVerticals, {
      fields: [potentialMetricDefinitions.verticalId],
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
    definition: one(potentialMetricDefinitions, {
      fields: [facilityPotentialValues.definitionId],
      references: [potentialMetricDefinitions.id],
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
    definition: one(potentialMetricDefinitions, {
      fields: [productPotentialLinks.definitionId],
      references: [potentialMetricDefinitions.id],
    }),
  }),
);
