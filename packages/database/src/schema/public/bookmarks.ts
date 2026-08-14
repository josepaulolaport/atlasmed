import {
  pgTable,
  timestamp,
  index,
  uniqueIndex,
  bigint,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { facilities } from "./facilities";
import { persons } from "./persons";

/**
 * "Favoritos" — a rep's own shortlist of clinics and doctors.
 *
 * Two tables rather than one polymorphic `(entity_type, entity_id)` table, for
 * the reason every other join table here is shaped this way: a real foreign key.
 * A polymorphic column cannot have one, so a deleted clinic would leave a
 * bookmark pointing at nothing and the integrity would live in application code
 * that nobody remembers to write.
 *
 * Private to the user. Nothing reads across `user_id`, and no manager view
 * exists — if one is ever wanted, the column is already here.
 *
 * Scope is deliberately *not* enforced by this table. A rep may hold a bookmark
 * for a clinic that later leaves their territory; the row survives so their
 * curation comes back if the territory does, and the read path filters it out
 * meanwhile. Storing scope here would mean rewriting bookmarks on every
 * territory change.
 */

/**
 * No `updated_at` on either table: a bookmark is created or gone, never edited.
 * The unique index is what makes the toggle idempotent — a double tap, or a
 * retried request on a flaky connection, is an `onConflictDoNothing` rather
 * than a second row.
 */
export const userFacilityBookmarks = pgTable(
  "user_facility_bookmarks",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    facilityId: bigint("facility_id", { mode: "number" })
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("user_facility_bookmarks_user_id_facility_id_uidx").on(
      t.userId,
      t.facilityId
    ),
    /** The list read: one user's bookmarks, newest first. */
    index("user_facility_bookmarks_user_id_created_at_idx").on(
      t.userId,
      t.createdAt.desc()
    ),
    /** Cascade support and "is this clinic bookmarked by anyone" lookups. */
    index("user_facility_bookmarks_facility_id_idx").on(t.facilityId),
  ]
);

/**
 * Doctors are bookmarked as the *person*, not as a (person, clinic) pair.
 *
 * A surgeon genuinely works out of several clinics in this data — Emultec
 * models each as its own pessoa-física row under a parent clinic, and 54 parent
 * CNPJs carry 175 of them. Pairing would list the same name once per clinic,
 * which is not what "save this doctor" means to a rep.
 */
export const userPersonBookmarks = pgTable(
  "user_person_bookmarks",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    personId: bigint("person_id", { mode: "number" })
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("user_person_bookmarks_user_id_person_id_uidx").on(
      t.userId,
      t.personId
    ),
    index("user_person_bookmarks_user_id_created_at_idx").on(
      t.userId,
      t.createdAt.desc()
    ),
    index("user_person_bookmarks_person_id_idx").on(t.personId),
  ]
);
