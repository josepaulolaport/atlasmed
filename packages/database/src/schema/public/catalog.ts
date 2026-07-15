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
import { sectors } from "./sectors";
import { facilities } from "./facilities";

export const products = pgTable(
  "products",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    // Enrichment columns (from legacy system)
    legacyId: text("legacy_id"),
    description: text("description"),
    barcode: text("barcode"),
    commercialCode: text("commercial_code"),
    productGroup: text("product_group"),
    productClassification: text("product_classification"),
    brand: text("brand"),
    unit: text("unit"),
    pictureUrl: text("picture_url"),
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
    index("products_legacy_id_idx").on(t.legacyId),
    unique("products_simpro_code_unique").on(t.simproCode),
    unique("products_brasindice_code_unique").on(t.brasindiceCode),
    unique("products_tiss_code_unique").on(t.tissCode),
  ]
);

export const productSectors = pgTable(
  "product_sectors",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    sectorId: text("sector_id").notNull().references(() => sectors.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("product_sectors_product_sector_uidx").on(t.productId, t.sectorId),
    index("product_sectors_sector_id_idx").on(t.sectorId),
  ]
);

export const competitorProducts = pgTable(
  "competitor_products",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    competitorName: text("competitor_name").notNull(),
    code: text("code"),
    name: text("name").notNull(),
    description: text("description"),
    barcode: text("barcode"),
    brand: text("brand"),
    unit: text("unit"),
    manufacturer: text("manufacturer"),
    countryOfOrigin: text("country_of_origin"),
    price17: numeric("price_17", { precision: 12, scale: 2 }),
    price18: numeric("price_18", { precision: 12, scale: 2 }),
    price20: numeric("price_20", { precision: 12, scale: 2 }),
    brasindiceUpdatedAt: date("brasindice_updated_at"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("competitor_products_competitor_name_idx").on(t.competitorName),
    index("competitor_products_is_active_idx").on(t.isActive),
  ]
);

export const competitorProductSectors = pgTable(
  "competitor_product_sectors",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    competitorProductId: text("competitor_product_id").notNull().references(() => competitorProducts.id, { onDelete: "cascade" }),
    sectorId: text("sector_id").notNull().references(() => sectors.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("competitor_product_sectors_competitor_product_id_sector_id_uidx").on(t.competitorProductId, t.sectorId),
    index("competitor_product_sectors_sector_id_idx").on(t.sectorId),
  ]
);

export const productEquivalences = pgTable(
  "product_equivalences",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    competitorProductId: text("competitor_product_id").notNull().references(() => competitorProducts.id, { onDelete: "cascade" }),
    note: text("note"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("product_equivalences_product_id_competitor_product_id_uidx").on(t.productId, t.competitorProductId),
    index("product_equivalences_competitor_product_idx").on(t.competitorProductId),
  ]
);

export const productsRelations = relations(products, ({ many }) => ({
  productSectors: many(productSectors),
  equivalences: many(productEquivalences),
}));

export const productSectorsRelations = relations(productSectors, ({ one }) => ({
  product: one(products, { fields: [productSectors.productId], references: [products.id] }),
  sector: one(sectors, { fields: [productSectors.sectorId], references: [sectors.id] }),
}));

export const competitorProductsRelations = relations(competitorProducts, ({ many }) => ({
  competitorProductSectors: many(competitorProductSectors),
  equivalences: many(productEquivalences),
  facilityStandards: many(facilityCompetitorProductStandards),
}));

export const competitorProductSectorsRelations = relations(competitorProductSectors, ({ one }) => ({
  competitorProduct: one(competitorProducts, { fields: [competitorProductSectors.competitorProductId], references: [competitorProducts.id] }),
  sector: one(sectors, { fields: [competitorProductSectors.sectorId], references: [sectors.id] }),
}));

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

