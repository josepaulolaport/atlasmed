import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { facilities } from "./facilities";
import { users } from "./users";

/** Explicit commercial-representative clinic visit event. */
export const visits = pgTable(
  "visits",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    facilityId: text("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "restrict" }),
    visitedAt: timestamp("visited_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("visits_user_id_visited_at_idx").on(t.userId, t.visitedAt),
    index("visits_facility_id_visited_at_idx").on(t.facilityId, t.visitedAt),
  ]
);
