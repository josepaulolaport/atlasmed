import { ne, or } from "drizzle-orm";
import {
  cnesCargaStaging,
  cnesProfessionalStaging,
  type AnyDatabase,
} from "@atlasmed/database";
import type { CnesReference } from "../cnes-files";

/**
 * Drop every staged competência except the one just promoted.
 *
 * Staging is ~316 MB a month — 1.85 M vínculos and 576 k professionals — and it
 * is a derived projection: it can be rebuilt from the archive without losing a
 * fact (invariant 9). Keeping superseded months buys nothing and grows without
 * bound.
 *
 * **One, not two.** The archives keep two competências because comparing against
 * the previous one is how you diagnose a bad load, and re-downloading it costs
 * 735 MB. Staging has no such use: nothing reads a superseded competência, and
 * if one is ever needed it comes back by reloading the archive that is still
 * there.
 *
 * Shared by both entry points on purpose. This is the third post-promotion step
 * the scheduled workflow and `archive-load.ts` each had to perform, and the first
 * two diverged — the ledger and the archive prune were each implemented in one
 * path and missing from the other. A single definition is what stops the next
 * one drifting.
 *
 * **Only after the run is marked COMPLETED.** Pruning first would leave a window
 * with no readable competência at all, and `deriveRosterFromStaging` would derive
 * an empty roster for anything importing in that moment.
 */
export async function pruneCnesStaging(input: {
  db: AnyDatabase;
  reference: CnesReference;
}): Promise<{ carga: number; professionals: number }> {
  const { db, reference } = input;

  const supersededCarga = or(
    ne(cnesCargaStaging.referenceYear, reference.year),
    ne(cnesCargaStaging.referenceMonth, reference.month)
  );
  const supersededProfessionals = or(
    ne(cnesProfessionalStaging.referenceYear, reference.year),
    ne(cnesProfessionalStaging.referenceMonth, reference.month)
  );

  const carga = await db.delete(cnesCargaStaging).where(supersededCarga);
  const professionals = await db
    .delete(cnesProfessionalStaging)
    .where(supersededProfessionals);

  return {
    carga: (carga as unknown as { count?: number }).count ?? 0,
    professionals: (professionals as unknown as { count?: number }).count ?? 0,
  };
}
