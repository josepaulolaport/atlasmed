import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { interactionTypeEnum } from "./enums";
import { facilities } from "./facilities";
import { users } from "./users";

/** Commercial interaction between a representative and a clinic. */
export const interactions = pgTable(
  "interactions",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    type: interactionTypeEnum("type").notNull(),
    summary: text("summary").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    facilityId: text("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "restrict" }),
    interactedAt: timestamp("interacted_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("interactions_user_id_interacted_at_idx").on(t.userId, t.interactedAt),
    index("interactions_facility_id_interacted_at_idx").on(t.facilityId, t.interactedAt),
  ]
);
