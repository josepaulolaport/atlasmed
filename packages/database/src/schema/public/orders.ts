import {
  pgTable,
  text,
  integer,
  numeric,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { orderStatusEnum, orderTypeEnum } from "./enums";
import { facilities } from "./facilities";
import { products } from "./catalog";

export const orders = pgTable(
  "orders",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    facilityId: text("facility_id").notNull().references(() => facilities.id, { onDelete: "restrict" }),
    status: orderStatusEnum("status").notNull().default("DRAFT"),
    type: orderTypeEnum("type").notNull().default("STANDARD"),
    notes: text("notes"),
    legacyId: text("legacy_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    confirmedAt: timestamp("confirmed_at"),
    shippedAt: timestamp("shipped_at"),
    deliveredAt: timestamp("delivered_at"),
    cancelledAt: timestamp("cancelled_at"),
    rejectedAt: timestamp("rejected_at"),
  },
  (t) => [
    index("orders_facility_id_idx").on(t.facilityId),
    index("orders_status_idx").on(t.status),
    index("orders_legacy_id_idx").on(t.legacyId),
  ]
);

export const orderItems = pgTable(
  "order_items",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    productId: text("product_id").notNull().references(() => products.id, { onDelete: "restrict" }),
    legacyProductId: text("legacy_product_id"),
    quantity: integer("quantity").notNull(),
    unitPrice: numeric("unit_price", { precision: 15, scale: 4 }).notNull(),
    totalPrice: numeric("total_price", { precision: 15, scale: 4 }).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("order_items_order_id_idx").on(t.orderId),
    index("order_items_product_id_idx").on(t.productId),
    index("order_items_legacy_product_id_idx").on(t.legacyProductId),
  ]
);

export const ordersRelations = relations(orders, ({ one, many }) => ({
  facility: one(facilities, { fields: [orders.facilityId], references: [facilities.id] }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
}));
