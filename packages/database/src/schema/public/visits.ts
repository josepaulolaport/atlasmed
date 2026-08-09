import { index, pgTable, text, timestamp,
  integer,
  bigint,
} from "drizzle-orm/pg-core";
import { facilities } from "./facilities";
import { users } from "./users";

/** Explicit commercial-representative clinic visit event. */
export const visits = pgTable(
  "visits",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    userId: bigint("user_id", { mode: "number" })
      .notNull().references(() => users.id, { onDelete: "restrict" }),
    facilityId: bigint("facility_id", { mode: "number" })
      .notNull().references(() => facilities.id, { onDelete: "restrict" }),
    visitedAt: timestamp("visited_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("visits_user_id_visited_at_idx").on(t.userId, t.visitedAt),
    index("visits_facility_id_visited_at_idx").on(t.facilityId, t.visitedAt),
  ]
);
