import {
  pgTable,
  text,
  boolean,
  timestamp,
  index,
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
    sectorId: text("sector_id").notNull().references(() => sectors.id, { onDelete: "restrict" }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("products_sector_id_idx").on(t.sectorId),
    index("products_is_active_idx").on(t.isActive),
  ]
);

export const productsRelations = relations(products, ({ one }) => ({
  sector: one(sectors, { fields: [products.sectorId], references: [sectors.id] }),
}));
