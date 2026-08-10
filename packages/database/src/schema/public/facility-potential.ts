import {
  pgTable,
  text,
  timestamp,
  numeric,
  index,
  uniqueIndex,
  unique,
  bigint,
  primaryKey,
  foreignKey,
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
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("product_potential_definitions_vertical_id_idx").on(t.verticalId),
    uniqueIndex("product_potential_definitions_vertical_key_active_uidx")
      .on(t.verticalId, t.key)
      .where(sql`${t.deletedAt} is null`),
    // Redundant beside the primary key, but a composite foreign key can only
    // reference a unique constraint. This is what lets a link pin the vertical
    // it claims against the vertical its definition actually has.
    unique("product_potential_definitions_id_vertical_id_key").on(t.id, t.verticalId),
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
 * Which of our products count toward which metric (spec 0013 §3).
 *
 * One definition per (product, vertical) — not one per product. `product_id`
 * used to be the primary key, which contradicted `product_verticals` being M2M:
 * a product sold in two linhas could carry a metric in one and, silently, none
 * in the other.
 *
 * `vertical_id` is denormalised here purely to carry that rule into the schema.
 * It is not independent data — the composite foreign key below ties it to the
 * definition's own vertical, so a link cannot claim a linha its definition does
 * not have.
 */
export const productPotentialLinks = pgTable(
  "product_potential_links",
  {
    productId: bigint("product_id", { mode: "number" })
      .notNull().references(() => products.id, { onDelete: "cascade" }),
    definitionId: bigint("definition_id", { mode: "number" }).notNull(),
    /** Always equal to the definition's vertical; the composite FK enforces it. */
    verticalId: bigint("vertical_id", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    primaryKey({
      name: "product_potential_links_pkey",
      columns: [t.productId, t.definitionId],
    }),
    index("product_potential_links_definition_id_idx").on(t.definitionId),
    // The rule that matters: a product resolves to at most one metric per linha,
    // so the penetration join can never double-count it.
    unique("product_potential_links_product_vertical_key").on(t.productId, t.verticalId),
    foreignKey({
      name: "product_potential_links_definition_vertical_fk",
      columns: [t.definitionId, t.verticalId],
      foreignColumns: [productPotentialDefinitions.id, productPotentialDefinitions.verticalId],
    }).onDelete("cascade"),
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
