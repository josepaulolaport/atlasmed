/**
 * Spec 0006: one REP per patch. Legacy Spec 0003 allowed multiple UTAs on
 * the same patch — this script duplicates geometry into one patch per extra
 * REP (keeps the earliest UTA on the original patch).
 *
 * Dry-run (default):
 *   bun run src/scripts/cleanup-legacy-multi-uta-patches.ts
 *
 * Apply:
 *   APPLY=1 bun run src/scripts/cleanup-legacy-multi-uta-patches.ts
 */
import "dotenv/config";
import { and, eq, sql } from "drizzle-orm";
import { territories, userTerritoryAssignments } from "@atlasmed/database";
import { db } from "../infrastructure/database/db";

type ConflictRow = {
  territory_id: string;
  territory_name: string;
  vertical_id: string;
  manager_territory_id: string | null;
  user_id: string;
  created_at: Date;
  assignment_rank: number;
};

async function main() {
  const apply = process.env.APPLY === "1";

  try {
    await run(apply);
  } finally {
    await db.$client.end({ timeout: 2 }).catch(() => undefined);
  }
}

async function run(apply: boolean) {
  const conflicts = (await db.execute(sql`
    WITH ranked AS (
      SELECT
        uta.territory_id,
        t.name AS territory_name,
        t.vertical_id,
        t.manager_territory_id,
        uta.user_id,
        uta.created_at,
        ROW_NUMBER() OVER (
          PARTITION BY uta.territory_id
          ORDER BY uta.created_at ASC NULLS LAST, uta.user_id ASC
        ) AS assignment_rank
      FROM user_territory_assignments uta
      INNER JOIN territories t ON t.id = uta.territory_id
      INNER JOIN territory_types tt ON tt.id = t.territory_type_id
      WHERE tt.slug = 'patch'
        AND t.is_active = true
    )
    SELECT *
    FROM ranked
    WHERE territory_id IN (
      SELECT territory_id FROM ranked GROUP BY territory_id HAVING COUNT(*) > 1
    )
    ORDER BY territory_id, assignment_rank
  `)) as ConflictRow[];

  if (conflicts.length === 0) {
    console.log("No multi-UTA patches found. Nothing to do.");
    return;
  }

  const byPatch = new Map<string, ConflictRow[]>();
  for (const row of conflicts) {
    const list = byPatch.get(row.territory_id) ?? [];
    list.push(row);
    byPatch.set(row.territory_id, list);
  }

  console.log(`Found ${byPatch.size} patch(es) with multiple UTAs.`);
  for (const [patchId, rows] of byPatch) {
    console.log(
      `- ${rows[0]!.territory_name} (${patchId}): ${rows.length} assignees`,
    );
  }

  if (!apply) {
    console.log("\nDry-run only. Re-run with APPLY=1 to duplicate patches.");
    return;
  }

  let created = 0;
  for (const [patchId, rows] of byPatch) {
    const extras = rows.slice(1);
    const [original] = await db
      .select()
      .from(territories)
      .where(eq(territories.id, patchId))
      .limit(1);
    if (!original) continue;

    for (const extra of extras) {
      const suffix = Date.now().toString(36);
      const [createdTerritory] = await db
        .insert(territories)
        .values({
          name: `${original.name} (${extra.user_id.slice(0, 6)})`,
          slug: `${original.slug}-${suffix}`,
          code: `${original.code}-${suffix}`.slice(0, 32),
          verticalId: original.verticalId,
          territoryTypeId: original.territoryTypeId,
          managerTerritoryId: original.managerTerritoryId,
          isActive: true,
        })
        .returning();

      if (!createdTerritory) {
        throw new Error(`Failed to create patch clone for ${patchId}`);
      }

      await db.execute(sql`
        UPDATE territories
        SET
          boundary = (SELECT boundary FROM territories WHERE id = ${patchId}),
          boundary_min_lng = (SELECT boundary_min_lng FROM territories WHERE id = ${patchId}),
          boundary_min_lat = (SELECT boundary_min_lat FROM territories WHERE id = ${patchId}),
          boundary_max_lng = (SELECT boundary_max_lng FROM territories WHERE id = ${patchId}),
          boundary_max_lat = (SELECT boundary_max_lat FROM territories WHERE id = ${patchId}),
          boundary_area_sq_km = (SELECT boundary_area_sq_km FROM territories WHERE id = ${patchId}),
          updated_at = now()
        WHERE id = ${createdTerritory.id}
      `);

      await db
        .update(userTerritoryAssignments)
        .set({ territoryId: createdTerritory.id })
        .where(
          and(
            eq(userTerritoryAssignments.territoryId, patchId),
            eq(userTerritoryAssignments.userId, extra.user_id),
          ),
        );

      created += 1;
      console.log(
        `Moved user ${extra.user_id} from ${patchId} → ${createdTerritory.id}`,
      );
    }
  }

  console.log(`\nDone. Created ${created} patch clone(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
