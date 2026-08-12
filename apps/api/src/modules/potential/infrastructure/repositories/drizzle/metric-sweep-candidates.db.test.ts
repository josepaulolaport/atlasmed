import { describe, expect, test } from "bun:test";
import {
  businessVerticals,
  facilities,
  facilityProductUsage,
  facilityVerticalProfiles,
  municipalities,
  orders,
  productPotentialDefinitions,
  products,
  states,
} from "@atlasmed/database";
import { listAllProfileIds, listProfilesWithChangedInputs } from "@atlasmed/database";
import { eq, sql } from "drizzle-orm";
import { isDatabaseReachable, withRollback } from "../../../../../test-utils/db-harness";

/**
 * The reconciliation sweep's candidate query (spec 0013 §4.4).
 *
 * The sweep exists because a Temporal start is a network call outside the
 * database transaction, so a trigger can be lost. What it must never become is a
 * scan of every profile every run — at ~14k clinics that does not hold up. These
 * assertions pin the behaviour the watermark depends on: the window is
 * half-open, both input tables contribute, and paging is keyset so a write
 * landing mid-sweep cannot cause a profile to be skipped.
 */
const dbUp = await isDatabaseReachable();

type Tx = Parameters<Parameters<typeof withRollback>[0]>[0];

async function seedProfiles(tx: Tx, suffix: string, count: number) {
  const [state] = await tx
    .insert(states)
    .values({ name: `W-${suffix}`, ibgeId: `7${suffix}`, abbreviation: `W${suffix}` })
    .returning({ id: states.id });
  const [municipality] = await tx
    .insert(municipalities)
    .values({ stateId: state!.id, name: `W-${suffix}`, ibgeId: `77${suffix}777` })
    .returning({ id: municipalities.id });
  const [facility] = await tx
    .insert(facilities)
    .values({
      displayName: `W-CLINIC-${suffix}`,
      legalDocumentType: "CNPJ",
      stateId: state!.id,
      municipalityId: municipality!.id,
      // Spec 0009 R5: every clinic has a position.
      location: sql`ST_SetSRID(ST_MakePoint(-46.6, -23.5), 4326)`,
    })
    .returning({ id: facilities.id });

  const profileIds: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const [vertical] = await tx
      .insert(businessVerticals)
      .values({ code: `W-${suffix}-${index}`, name: `W-${suffix}-${index}` })
      .returning({ id: businessVerticals.id });
    const [profile] = await tx
      .insert(facilityVerticalProfiles)
      .values({ facilityId: facility!.id, verticalId: vertical!.id })
      .returning({ id: facilityVerticalProfiles.id });
    profileIds.push(profile!.id);
  }
  return { facilityId: facility!.id, profileIds };
}

async function seedOrderAt(tx: Tx, profileId: number, updatedAt: Date) {
  await tx.insert(orders).values({
    facilityVerticalProfileId: profileId,
    orderedAt: new Date("2026-03-10T12:00:00.000Z"),
    type: "SALE",
    status: "APPROVED",
    updatedAt,
  });
}

describe.skipIf(!dbUp)("metric sweep candidates (database)", () => {
  test("finds profiles whose orders changed inside the window, and no others", async () => {
    await withRollback(async (tx) => {
      const { profileIds } = await seedProfiles(tx, "ORD", 3);
      const [inside, before, after] = profileIds as [number, number, number];

      await seedOrderAt(tx, inside, new Date("2026-05-10T12:00:00.000Z"));
      await seedOrderAt(tx, before, new Date("2026-05-01T12:00:00.000Z"));
      await seedOrderAt(tx, after, new Date("2026-05-20T12:00:00.000Z"));

      const found = await listProfilesWithChangedInputs(tx as never, {
        since: new Date("2026-05-05T00:00:00.000Z"),
        until: new Date("2026-05-15T00:00:00.000Z"),
        afterProfileId: 0,
        limit: 500,
      });

      expect(found).toContain(inside);
      expect(found).not.toContain(before);
      expect(found).not.toContain(after);
    });
  });

  test("the window is half-open, so a boundary row belongs to exactly one run", async () => {
    await withRollback(async (tx) => {
      const { profileIds } = await seedProfiles(tx, "BND", 2);
      const [atStart, atEnd] = profileIds as [number, number];

      const since = new Date("2026-05-05T00:00:00.000Z");
      const until = new Date("2026-05-15T00:00:00.000Z");
      await seedOrderAt(tx, atStart, since);
      await seedOrderAt(tx, atEnd, until);

      const thisRun = await listProfilesWithChangedInputs(tx as never, {
        since,
        until,
        afterProfileId: 0,
        limit: 500,
      });
      // The next run starts where this one stopped.
      const nextRun = await listProfilesWithChangedInputs(tx as never, {
        since: until,
        until: new Date("2026-05-25T00:00:00.000Z"),
        afterProfileId: 0,
        limit: 500,
      });

      expect(thisRun).toContain(atStart);
      expect(thisRun).not.toContain(atEnd);
      expect(nextRun).toContain(atEnd);
      // Counted once overall, never twice — otherwise `differed` would overstate
      // how often triggers are lost.
      expect(nextRun).not.toContain(atStart);
    });
  });

  test("a usage edit alone makes a profile a candidate", async () => {
    await withRollback(async (tx) => {
      const { profileIds } = await seedProfiles(tx, "USG", 1);
      const profileId = profileIds[0]!;

      const [profile] = await tx
        .select({ verticalId: facilityVerticalProfiles.verticalId })
        .from(facilityVerticalProfiles)
        .where(eq(facilityVerticalProfiles.id, profileId));
      const [definition] = await tx
        .insert(productPotentialDefinitions)
        .values({ verticalId: profile!.verticalId, key: "w-usg", label: "Ampolas" })
        .returning({ id: productPotentialDefinitions.id });
      const [product] = await tx
        .insert(products)
        .values({
          name: "W-USG-COMP",
          manufacturer: "W",
          countryOfOrigin: "BR",
          price17: "1",
          price18: "1",
          price20: "1",
          ownership: "COMPETITOR",
          metricUnits: "1",
        })
        .returning({ id: products.id });

      // No order at all — only the rep's edit.
      await tx.insert(facilityProductUsage).values({
        facilityVerticalProfileId: profileId,
        definitionId: definition!.id,
        verticalId: profile!.verticalId,
        productId: product!.id,
        quantity: "12",
        updatedAt: new Date("2026-05-10T12:00:00.000Z"),
      });

      const found = await listProfilesWithChangedInputs(tx as never, {
        since: new Date("2026-05-05T00:00:00.000Z"),
        until: new Date("2026-05-15T00:00:00.000Z"),
        afterProfileId: 0,
        limit: 500,
      });

      expect(found).toContain(profileId);
    });
  });

  test("pages by keyset, returning each profile exactly once", async () => {
    await withRollback(async (tx) => {
      const { profileIds } = await seedProfiles(tx, "PAGE", 5);
      const stamp = new Date("2026-05-10T12:00:00.000Z");
      for (const profileId of profileIds) {
        await seedOrderAt(tx, profileId, stamp);
        // A second order for the same profile must not duplicate it.
        await seedOrderAt(tx, profileId, stamp);
      }

      const collected: number[] = [];
      let after = 0;
      for (let page = 0; page < 10; page += 1) {
        const batch = await listProfilesWithChangedInputs(tx as never, {
          since: new Date("2026-05-05T00:00:00.000Z"),
          until: new Date("2026-05-15T00:00:00.000Z"),
          afterProfileId: after,
          limit: 2,
        });
        if (batch.length === 0) break;
        collected.push(...batch);
        after = batch[batch.length - 1]!;
      }

      const mine = collected.filter((id) => profileIds.includes(id));
      expect(mine.sort((a, b) => a - b)).toEqual([...profileIds].sort((a, b) => a - b));
      expect(new Set(mine).size).toBe(mine.length);
    });
  });

  test("listAllProfileIds pages every profile without a window", async () => {
    await withRollback(async (tx) => {
      const { profileIds } = await seedProfiles(tx, "ALL", 3);

      const collected: number[] = [];
      let after = Math.min(...profileIds) - 1;
      for (let page = 0; page < 10; page += 1) {
        const batch = await listAllProfileIds(tx as never, { afterProfileId: after, limit: 2 });
        if (batch.length === 0) break;
        collected.push(...batch);
        after = batch[batch.length - 1]!;
      }

      for (const profileId of profileIds) expect(collected).toContain(profileId);
    });
  });
});
