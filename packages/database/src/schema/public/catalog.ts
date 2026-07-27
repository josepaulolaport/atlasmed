import {
  pgTable,
  text,
  boolean,
  timestamp,
  integer,
  index,
  uniqueIndex,
  numeric,
  date,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { businessVerticals } from "./business-verticals";
import { facilities } from "./facilities";

export const products = pgTable(
  "products",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    // Enrichment columns (from legacy system)
    legacyId: integer("legacy_id"),
    legacySupplierId: integer("legacy_supplier_id"),
    legacyCreatedAt: timestamp("legacy_created_at"),
    description: text("description"),
    barcode: text("barcode"),
    commercialCode: text("commercial_code"),
    productGroup: text("product_group"),
    productClassification: text("product_classification"),
    internalClassification: text("internal_classification"),
    brand: text("brand"),
    unit: text("unit"),
    requiresSterilization: boolean("requires_sterilization").notNull().default(false),
    anvisaRegistration: text("anvisa_registration"),
    ncm: text("ncm"),
    pictureUrl: text("picture_url"),
    pictureBlurhash: text("picture_blurhash"),
    // Pricing and coding columns
    simproCode: text("simpro_code").notNull(),
    brasindiceCode: text("brasindice_code").notNull(),
    tissCode: text("tiss_code").notNull(),
    manufacturer: text("manufacturer").notNull(),
    countryOfOrigin: text("country_of_origin").notNull(),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    price17: numeric("price_17", { precision: 12, scale: 2 }).notNull(),
    price18: numeric("price_18", { precision: 12, scale: 2 }).notNull(),
    price20: numeric("price_20", { precision: 12, scale: 2 }).notNull(),
    brasindiceUpdatedAt: date("brasindice_updated_at").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("products_is_active_idx").on(t.isActive),
    index("products_product_group_idx").on(t.productGroup),
    uniqueIndex("products_simpro_code_unique").on(t.simproCode),
    uniqueIndex("products_brasindice_code_unique").on(t.brasindiceCode),
    uniqueIndex("products_tiss_code_unique").on(t.tissCode),
    unique("products_legacy_id_key").on(t.legacyId),
  ]
);

export const productVerticals = pgTable(
  "product_verticals",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    verticalId: text("vertical_id")
      .notNull()
      .references(() => businessVerticals.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("product_verticals_product_id_idx").on(t.productId),
    index("product_verticals_vertical_id_idx").on(t.verticalId),
    unique("product_verticals_unique").on(t.productId, t.verticalId),
  ]
);

export const competitorProducts = pgTable(
  "competitor_products",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    code: text("code"),
    name: text("name").notNull(),
    manufacturer: text("manufacturer"),
    brand: text("brand"),
    isActive: boolean("is_active").notNull().default(true),
    legacyId: integer("legacy_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    countryOfOrigin: text("country_of_origin"),
    price17: numeric("price_17", { precision: 12, scale: 2 }),
    price18: numeric("price_18", { precision: 12, scale: 2 }),
    price20: numeric("price_20", { precision: 12, scale: 2 }),
    brasindiceUpdatedAt: date("brasindice_updated_at"),
  },
  (t) => [
    index("competitor_products_is_active_idx").on(t.isActive),
    index("competitor_products_manufacturer_idx").on(t.manufacturer),
    unique("competitor_products_legacy_id_key").on(t.legacyId),
  ]
);

export const competitorProductVerticals = pgTable(
  "competitor_product_verticals",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    competitorProductId: text("competitor_product_id")
      .notNull()
      .references(() => competitorProducts.id, { onDelete: "cascade" }),
    verticalId: text("vertical_id")
      .notNull()
      .references(() => businessVerticals.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("competitor_product_verticals_cp_id_idx").on(t.competitorProductId),
    index("competitor_product_verticals_vertical_id_idx").on(t.verticalId),
    unique("competitor_product_verticals_unique").on(
      t.competitorProductId,
      t.verticalId
    ),
  ]
);

export const productEquivalences = pgTable(
  "product_equivalences",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    competitorProductId: text("competitor_product_id").notNull().references(() => competitorProducts.id, { onDelete: "cascade" }),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("product_equivalences_cp_id_idx").on(t.competitorProductId),
    index("product_equivalences_product_id_idx").on(t.productId),
    unique("product_equivalences_unique").on(t.competitorProductId, t.productId),
  ]
);

export const productsRelations = relations(products, ({ many }) => ({
  productVerticals: many(productVerticals),
  equivalences: many(productEquivalences),
}));

export const productVerticalsRelations = relations(productVerticals, ({ one }) => ({
  product: one(products, { fields: [productVerticals.productId], references: [products.id] }),
  vertical: one(businessVerticals, {
    fields: [productVerticals.verticalId],
    references: [businessVerticals.id],
  }),
}));

export const competitorProductsRelations = relations(competitorProducts, ({ many }) => ({
  competitorProductVerticals: many(competitorProductVerticals),
  equivalences: many(productEquivalences),
  facilityStandards: many(facilityCompetitorProductStandards),
}));

export const competitorProductVerticalsRelations = relations(
  competitorProductVerticals,
  ({ one }) => ({
    competitorProduct: one(competitorProducts, {
      fields: [competitorProductVerticals.competitorProductId],
      references: [competitorProducts.id],
    }),
    vertical: one(businessVerticals, {
      fields: [competitorProductVerticals.verticalId],
      references: [businessVerticals.id],
    }),
  })
);

export const productEquivalencesRelations = relations(productEquivalences, ({ one }) => ({
  product: one(products, { fields: [productEquivalences.productId], references: [products.id] }),
  competitorProduct: one(competitorProducts, { fields: [productEquivalences.competitorProductId], references: [competitorProducts.id] }),
}));

export const facilityCompetitorProductStandards = pgTable(
  "facility_competitor_product_standards",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    facilityId: text("facility_id").notNull().references(() => facilities.id, { onDelete: "cascade" }),
    competitorProductId: text("competitor_product_id").notNull().references(() => competitorProducts.id, { onDelete: "restrict" }),
    standardizedQuantity: integer("standardized_quantity"),
    source: text("source").notNull().default("crm"),
    sourceFirstSeenAt: timestamp("source_first_seen_at"),
    sourceLastSeenAt: timestamp("source_last_seen_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("facility_competitor_product_standards_pair_uidx").on(t.facilityId, t.competitorProductId),
    index("facility_competitor_product_standards_facility_idx").on(t.facilityId),
    index("facility_competitor_product_standards_competitor_idx").on(t.competitorProductId),
  ]
);

export const facilityCompetitorProductStandardsRelations = relations(facilityCompetitorProductStandards, ({ one }) => ({
  facility: one(facilities, { fields: [facilityCompetitorProductStandards.facilityId], references: [facilities.id] }),
  competitorProduct: one(competitorProducts, { fields: [facilityCompetitorProductStandards.competitorProductId], references: [competitorProducts.id] }),
}));

