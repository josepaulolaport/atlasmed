import { describe, expect, test } from "bun:test";
import {
  businessVerticals,
  facilities,
  facilityVerticalProfiles,
  municipalities,
  states,
} from "@atlasmed/database";
import { sql } from "drizzle-orm";
import {
  isDatabaseReachable,
  uniqueAbbreviation,
  withRollback,
} from "../../../../../test-utils/db-harness";
import {
  funnelStageToPurchaseBucket,
  type FacilityPurchaseFunnelStage,
} from "../../../application/list-facilities-query";
import { buildMapPurchaseBucketSql } from "./drizzle-facility.repository";

/**
 * The live map's pin colour must agree with the Desempenho donut.
 *
 * `listMapPoints` wrote the bucket grouping out by hand, so when the grouping was
 * corrected to follow the purchase timeline, the map kept the old split — a
 * clinic that bought last week showed Ativa in the list and Inativa on the map.
 *
 * This executes the repository's own expression against a real database rather
 * than a transcription of it: a copy in the test would keep passing while the
 * production SQL drifted, which is how the two diverged in the first place. It
 * also drives every stage through, so a bucket boundary cannot move on one side
 * only.
 *
 * Verified to fail against the hand-written CASE.
 */
const dbUp = await isDatabaseReachable();

const STAGES: FacilityPurchaseFunnelStage[] = [
  "NEVER_PURCHASED",
  "OUTSIDE_WINDOW",
  "PURCHASE_WINDOW",
  "CHURN",
  "INACTIVE",
];

describe.skipIf(!dbUp)("map pin bucket matches the funnel grouping", () => {
  test("every stage colours the pin the way the donut counts it", async () => {
    await withRollback(async (tx) => {
      const suffix = `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
      const [vertical] = await tx
        .insert(businessVerticals)
        .values({ code: `T-MAP-${suffix}`, name: "T-MAP" })
        .returning({ id: businessVerticals.id });
      const [state] = await tx
        .insert(states)
        .values({
          name: `T-State-${suffix}`,
          ibgeId: `T${suffix}`.slice(0, 12),
          abbreviation: uniqueAbbreviation(),
        })
        .returning({ id: states.id });
      const [municipality] = await tx
        .insert(municipalities)
        .values({
          stateId: state!.id,
          name: "T-City",
          ibgeId: `T${suffix}`.slice(0, 12),
        })
        .returning({ id: municipalities.id });

      const byStage = new Map<FacilityPurchaseFunnelStage, number>();
      for (const stage of STAGES) {
        const [facility] = await tx
          .insert(facilities)
          .values({
            displayName: `MAPA ${stage}`,
            legalDocumentType: "CNPJ",
            // Spec 0015: every facility names a CNES establishment. Unique per
            // row — one facility is created for each funnel stage.
            cnesCode: crypto.randomUUID(),
            stateId: state!.id,
            municipalityId: municipality!.id,
            // Spec 0009 R5: every clinic has a position.
            location: sql`ST_SetSRID(ST_MakePoint(-46.6, -23.5), 4326)`,
          })
          .returning({ id: facilities.id });
        await tx.insert(facilityVerticalProfiles).values({
          facilityId: facility!.id,
          verticalId: vertical!.id,
          purchaseFunnelStage: stage,
        });
        byStage.set(stage, facility!.id);
      }

      const bucketSql = buildMapPurchaseBucketSql(
        sql`and p.vertical_id = ${vertical!.id}`,
      );
      const rows = await tx.execute<{ id: number; bucket: string }>(sql`
        SELECT ${facilities.id} AS id, ${bucketSql} AS bucket
        FROM ${facilities}
        WHERE ${facilities.id} IN (${sql.join(
          [...byStage.values()].map((id) => sql`${id}`),
          sql`, `,
        )})
      `);

      const bucketById = new Map(
        Array.from(rows, (row) => {
          const r = row as { id: number | string; bucket: string };
          return [Number(r.id), r.bucket] as const;
        }),
      );

      expect(bucketById.size).toBe(STAGES.length);
      for (const stage of STAGES) {
        expect(bucketById.get(byStage.get(stage)!)).toBe(
          funnelStageToPurchaseBucket(stage),
        );
      }
    });
  });
});
