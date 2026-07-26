import {
  pgTable,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { orderStatusEnum, orderTypeEnum } from "./enums";
import { businessVerticals } from "./business-verticals";
import { facilities, professionals } from "./facilities";
import { products } from "./catalog";
import { users } from "./users";

export const orders = pgTable(
  "orders",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    legacyId: integer("legacy_id"),
    facilityId: text("facility_id").notNull().references(() => facilities.id),
    /** Commercial vertical for this order (one vertical per order). */
    verticalId: text("vertical_id")
      .notNull()
      .references(() => businessVerticals.id, { onDelete: "restrict" }),
    sellerId: text("seller_id").references(() => users.id),
    professionalId: text("professional_id").references(() => professionals.id),
    status: orderStatusEnum("status").notNull().default("DRAFT"),
    type: orderTypeEnum("type").notNull().default("SALE"),
    surgeryType: text("surgery_type"),
    surgerySubtype: text("surgery_subtype"),
    orderedAt: timestamp("ordered_at").notNull(),
    notes: text("notes"),
    freight: numeric("freight", { precision: 10, scale: 2 }).notNull().default("0"),
    grossWeight: numeric("gross_weight", { precision: 10, scale: 3 }).notNull().default("0"),
    netWeight: numeric("net_weight", { precision: 10, scale: 3 }).notNull().default("0"),
    currency: text("currency").notNull().default("BRL"),
    usdExchangeRate: numeric("usd_exchange_rate", { precision: 10, scale: 4 }),
    finalizedById: text("finalized_by_id").references(() => users.id),
    finalizedAt: timestamp("finalized_at"),
    rejectedById: text("rejected_by_id").references(() => users.id),
    rejectionReason: text("rejection_reason"),
    noBillingById: text("no_billing_by_id").references(() => users.id),
    noBillingAt: timestamp("no_billing_at"),
    noBillingNotes: text("no_billing_notes"),
    expenseAuthorizedById: text("expense_authorized_by_id").references(() => users.id),
    expenseAuthorizedAt: timestamp("expense_authorized_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("orders_facility_id_idx").on(t.facilityId),
    index("orders_vertical_id_idx").on(t.verticalId),
    index("orders_status_idx").on(t.status),
    index("orders_legacy_id_idx").on(t.legacyId),
    index("orders_ordered_at_idx").on(t.orderedAt),
    index("orders_professional_id_idx").on(t.professionalId),
    index("orders_seller_id_idx").on(t.sellerId),
    unique("orders_legacy_id_key").on(t.legacyId),
  ]
);

export const orderItems = pgTable(
  "order_items",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    legacyId: integer("legacy_id"),
    orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    productId: text("product_id").references(() => products.id),
    legacyProductId: integer("legacy_product_id"),
    lineNumber: integer("line_number"),
    quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull().default("0"),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull().default("0"),
    usdPrice: numeric("usd_price", { precision: 12, scale: 4 }).notNull().default("0"),
    batchNumber: text("batch_number"),
    writtenOff: boolean("written_off").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("order_items_batch_number_idx").on(t.batchNumber),
    index("order_items_order_id_idx").on(t.orderId),
    index("order_items_product_id_idx").on(t.productId),
    unique("order_items_legacy_id_key").on(t.legacyId),
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
