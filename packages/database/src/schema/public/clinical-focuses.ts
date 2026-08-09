import {
  pgTable,
  text,
  timestamp,
  bigint,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * CRM catalog of clinical focuses a facility may offer (e.g. Ortopedia).
 * Not the same as business_verticals (Linha) or doctor specialties.
 * Facility links live in `facility_clinical_focuses` (facilities.ts).
 */
export const clinicalFocuses = pgTable(
  "clinical_focuses",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    name: text("name").notNull(),
    /** Optional CNES code when mapped from official catalogs. */
    cnesCode: text("cnes_code"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("clinical_focuses_name_uidx").on(t.name),
    uniqueIndex("clinical_focuses_cnes_code_uidx")
      .on(t.cnesCode)
      .where(sql`${t.cnesCode} IS NOT NULL`),
    index("clinical_focuses_is_active_idx").on(t.isActive),
  ]
);
