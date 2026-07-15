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
import { sectors } from "./sectors";

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
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("products_is_active_idx").on(t.isActive),
    index("products_legacy_id_idx").on(t.legacyId),
  ]
);

export const productSectors = pgTable(
  "product_sectors",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    sectorId: text("sector_id").notNull().references(() => sectors.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
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
  },
  (t) => [
    uniqueIndex("competitor_product_sectors_uidx").on(t.competitorProductId, t.sectorId),
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
}));

export const competitorProductSectorsRelations = relations(competitorProductSectors, ({ one }) => ({
  competitorProduct: one(competitorProducts, { fields: [competitorProductSectors.competitorProductId], references: [competitorProducts.id] }),
  sector: one(sectors, { fields: [competitorProductSectors.sectorId], references: [sectors.id] }),
}));

export const productEquivalencesRelations = relations(productEquivalences, ({ one }) => ({
  product: one(products, { fields: [productEquivalences.productId], references: [products.id] }),
  competitorProduct: one(competitorProducts, { fields: [productEquivalences.competitorProductId], references: [competitorProducts.id] }),
}));
