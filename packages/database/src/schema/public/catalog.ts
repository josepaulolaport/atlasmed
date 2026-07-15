import {
  pgTable,
  text,
  boolean,
  timestamp,
  integer,
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
    isActive: boolean("is_active").notNull().default(true),

    // Traceability back to legacy MySQL ERP
    legacyId: integer("legacy_id").unique(),

    // Identity
    description: text("description"),
    barcode: text("barcode"),
    commercialCode: text("commercial_code"),

    // Classification
    productGroup: text("product_group"),
    productClassification: text("product_classification"),
    brand: text("brand"),
    internalClassification: text("internal_classification"),

    // Physical / operational
    unit: text("unit"),
    requiresSterilization: boolean("requires_sterilization").notNull().default(false),

    // Regulatory
    registroAnvisa: text("registro_anvisa"),
    ncm: text("ncm"),
    codigoTiss: text("codigo_tiss"),
    codigoSimpro: text("codigo_simpro"),

    // Supplier reference (no FK until suppliers table exists)
    legacySupplierId: integer("legacy_supplier_id"),

    // Media
    imageUrl: text("image_url"),

    // Legacy audit
    legacyCreatedAt: timestamp("legacy_created_at"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("products_is_active_idx").on(t.isActive),
    index("products_product_group_idx").on(t.productGroup),
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
    uniqueIndex("product_sectors_product_id_sector_id_uidx").on(t.productId, t.sectorId),
    index("product_sectors_product_id_idx").on(t.productId),
    index("product_sectors_sector_id_idx").on(t.sectorId),
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

// ---------------------------------------------------------------------------
// Competitor products
// ---------------------------------------------------------------------------

export const competitorProducts = pgTable(
  "competitor_products",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    code: text("code"),
    name: text("name").notNull(),
    manufacturer: text("manufacturer"),
    brand: text("brand"),
    isActive: boolean("is_active").notNull().default(true),
    legacyId: integer("legacy_id").unique(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("competitor_products_is_active_idx").on(t.isActive),
    index("competitor_products_manufacturer_idx").on(t.manufacturer),
  ]
);

export const competitorProductSectors = pgTable(
  "competitor_product_sectors",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    competitorProductId: text("competitor_product_id")
      .notNull()
      .references(() => competitorProducts.id, { onDelete: "cascade" }),
    sectorId: text("sector_id").notNull().references(() => sectors.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("competitor_product_sectors_cp_id_sector_id_uidx").on(t.competitorProductId, t.sectorId),
    index("competitor_product_sectors_cp_id_idx").on(t.competitorProductId),
    index("competitor_product_sectors_sector_id_idx").on(t.sectorId),
  ]
);

export const productEquivalences = pgTable(
  "product_equivalences",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    competitorProductId: text("competitor_product_id")
      .notNull()
      .references(() => competitorProducts.id, { onDelete: "cascade" }),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("product_equivalences_product_id_cp_id_uidx").on(t.productId, t.competitorProductId),
    index("product_equivalences_product_id_idx").on(t.productId),
    index("product_equivalences_cp_id_idx").on(t.competitorProductId),
  ]
);

export const competitorProductsRelations = relations(competitorProducts, ({ many }) => ({
  competitorProductSectors: many(competitorProductSectors),
  equivalences: many(productEquivalences),
}));

export const competitorProductSectorsRelations = relations(competitorProductSectors, ({ one }) => ({
  competitorProduct: one(competitorProducts, {
    fields: [competitorProductSectors.competitorProductId],
    references: [competitorProducts.id],
  }),
  sector: one(sectors, { fields: [competitorProductSectors.sectorId], references: [sectors.id] }),
}));

export const productEquivalencesRelations = relations(productEquivalences, ({ one }) => ({
  product: one(products, { fields: [productEquivalences.productId], references: [products.id] }),
  competitorProduct: one(competitorProducts, {
    fields: [productEquivalences.competitorProductId],
    references: [competitorProducts.id],
  }),
}));
