import {
  pgTable,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  index,
  unique,
  bigint,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { orderStatusEnum, orderTypeEnum } from "./enums";
import { businessVerticals } from "./business-verticals";
import { facilities, professionals } from "./facilities";
import { products } from "./catalog";
import { users } from "./users";

export const orders = pgTable(
  "orders",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    legacyId: bigint("legacy_id", { mode: "number" }),
    facilityId: bigint("facility_id", { mode: "number" }).notNull().references(() => facilities.id),
    /** Commercial vertical for this order (one vertical per order). */
    verticalId: bigint("vertical_id", { mode: "number" })
      .notNull().references(() => businessVerticals.id, { onDelete: "restrict" }),
    sellerId: bigint("seller_id", { mode: "number" }).references(() => users.id),
    professionalId: bigint("professional_id", { mode: "number" }).references(() => professionals.id),
    status: orderStatusEnum("status").notNull().default("DRAFT"),
    type: orderTypeEnum("type").notNull().default("SALE"),
    orderedAt: timestamp("ordered_at").notNull(),
    notes: text("notes"),
    freight: numeric("freight", { precision: 10, scale: 2 }).notNull().default("0"),
    grossWeight: numeric("gross_weight", { precision: 10, scale: 3 }).notNull().default("0"),
    netWeight: numeric("net_weight", { precision: 10, scale: 3 }).notNull().default("0"),
    currency: text("currency").notNull().default("BRL"),
    finalizedById: bigint("finalized_by_id", { mode: "number" }).references(() => users.id),
    finalizedAt: timestamp("finalized_at"),
    rejectedById: bigint("rejected_by_id", { mode: "number" }).references(() => users.id),
    rejectionReason: text("rejection_reason"),
    noBillingById: bigint("no_billing_by_id", { mode: "number" }).references(() => users.id),
    noBillingAt: timestamp("no_billing_at"),
    noBillingNotes: text("no_billing_notes"),
    expenseAuthorizedById: bigint("expense_authorized_by_id", { mode: "number" }).references(() => users.id),
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
    index("orders_valid_purchase_facility_ordered_at_idx")
      .on(t.facilityId, t.orderedAt.desc())
      .where(sql`${t.status} in ('APPROVED', 'INVOICED') and ${t.type} in ('SALE', 'CONSIGNMENT')`),
    index("orders_valid_purchase_facility_vertical_ordered_at_idx")
      .on(t.facilityId, t.verticalId, t.orderedAt.desc())
      .where(sql`${t.status} in ('APPROVED', 'INVOICED') and ${t.type} in ('SALE', 'CONSIGNMENT')`),
    index("orders_updated_at_facility_id_idx").on(t.updatedAt, t.facilityId),
    unique("orders_legacy_id_key").on(t.legacyId),
  ]
);

export const orderItems = pgTable(
  "order_items",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    legacyId: bigint("legacy_id", { mode: "number" }),
    orderId: bigint("order_id", { mode: "number" }).notNull().references(() => orders.id, { onDelete: "cascade" }),
    productId: bigint("product_id", { mode: "number" }).references(() => products.id),
    legacyProductId: bigint("legacy_product_id", { mode: "number" }),
    lineNumber: bigint("line_number", { mode: "number" }),
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
