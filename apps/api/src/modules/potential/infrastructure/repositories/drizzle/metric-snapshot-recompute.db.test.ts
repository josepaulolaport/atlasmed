import { describe, expect, test } from "bun:test";
import {
  businessVerticals,
  facilities,
  facilityMetricSnapshots,
  facilityProductUsage,
  facilityVerticalProfiles,
  municipalities,
  orderItems,
  orders,
  productPotentialDefinitions,
  productEquivalences,
  productPotentialLinks,
  products,
  states,
} from "@atlasmed/database";
import { and, eq, sql } from "drizzle-orm";
import { isDatabaseReachable, withRollback } from "../../../../../test-utils/db-harness";
import { DrizzlePotentialRepository } from "./drizzle-potential.repository";
import { RecomputeMetricSnapshotsUseCase } from "../../../application/use-cases/recompute-metric-snapshots.use-case";
import { ListFacilityPotentialsUseCase } from "../../../application/use-cases/potential.use-cases";

/**
 * The recompute handler, against a real Postgres (spec 0013 §4.4).
 *
 * The claim under test is idempotency — "run once or fifty times, the row is
 * identical" — and it is a claim about what the database ends up holding. A fake
 * repository that echoes what the handler wrote would prove nothing, so every
 * assertion here reads the table back.
 *
 * One row per (profile, metric) since §4.6, so there is no month to address a
 * snapshot by, and `ours` is a 90-day window rather than a calendar month.
 */
const dbUp = await isDatabaseReachable();

type Tx = Parameters<Parameters<typeof withRollback>[0]>[0];

async function seedScenario(tx: Tx, suffix: string) {
  const [state] = await tx
    .insert(states)
    .values({ name: `S-${suffix}`, ibgeId: `8${suffix}`, abbreviation: `S${suffix}` })
    .returning({ id: states.id });
  const [municipality] = await tx
    .insert(municipalities)
    .values({ stateId: state!.id, name: `M-${suffix}`, ibgeId: `88${suffix}888` })
    .returning({ id: municipalities.id });
  const [facility] = await tx
    .insert(facilities)
    .values({
      // Spec 0015: every facility carries the CNES establishment it came from.
      cnesCode: crypto.randomUUID(),
      displayName: `S-CLINIC-${suffix}`,
      legalDocumentType: "CNPJ",
      stateId: state!.id,
      municipalityId: municipality!.id,
      // Spec 0009 R5: every clinic has a position.
      location: sql`ST_SetSRID(ST_MakePoint(-46.6, -23.5), 4326)`,
    })
    .returning({ id: facilities.id });
  const [vertical] = await tx
    .insert(businessVerticals)
    .values({ code: `S-SNAP-${suffix}`, name: `S-SNAP-${suffix}` })
    .returning({ id: businessVerticals.id });
  const [profile] = await tx
    .insert(facilityVerticalProfiles)
    .values({ facilityId: facility!.id, verticalId: vertical!.id })
    .returning({ id: facilityVerticalProfiles.id });
  const [definition] = await tx
    .insert(productPotentialDefinitions)
    .values({ verticalId: vertical!.id, key: `s-snap-${suffix}`, label: "Ampolas" })
    .returning({ id: productPotentialDefinitions.id });

  return {
    facilityId: facility!.id,
    verticalId: vertical!.id,
    profileId: profile!.id,
    definitionId: definition!.id,
  };
}

async function seedProduct(
  tx: Tx,
  scenario: { verticalId: number; definitionId: number },
  input: { name: string; metricUnits: string; ownership: "OWN" | "COMPETITOR"; link: boolean },
) {
  const [product] = await tx
    .insert(products)
    .values({
      name: input.name,
      manufacturer: "S-Manufacturer",
      countryOfOrigin: "BR",
      price17: "1",
      price18: "1",
      price20: "1",
      metricUnits: input.metricUnits,
      ownership: input.ownership,
    })
    .returning({ id: products.id });
  if (input.link && input.ownership === "OWN") {
    await tx.insert(productPotentialLinks).values({
      productId: product!.id,
      definitionId: scenario.definitionId,
      verticalId: scenario.verticalId,
    });
  }
  if (input.link && input.ownership === "COMPETITOR") {
    // A competitor product is never linked to a metric — the catalogue screen
    // links our variants, and nothing offers a competitor there. It counts
    // because it is the equivalent of one of ours that *is* linked, which is
    // the relation the comparativo screen maintains. Seeding it any other way
    // would be testing a shape production cannot produce.
    const anchor = await seedProduct(tx, scenario, {
      name: `${input.name}-ANCHOR`,
      metricUnits: "1",
      ownership: "OWN",
      link: true,
    });
    await tx.insert(productEquivalences).values({
      productId: anchor,
      competitorProductId: product!.id,
    });
  }
  return product!.id;
}

async function seedOrder(
  tx: Tx,
  input: { profileId: number; productId: number; quantity: string; orderedAt: Date },
) {
  const [order] = await tx
    .insert(orders)
    .values({
      facilityVerticalProfileId: input.profileId,
      orderedAt: input.orderedAt,
      type: "SALE",
      status: "APPROVED",
    })
    .returning({ id: orders.id });
  await tx.insert(orderItems).values({
    orderId: order!.id,
    productId: input.productId,
    quantity: input.quantity,
  });
  return order!.id;
}

async function readSnapshot(tx: Tx, profileId: number) {
  const [row] = await tx
    .select({
      oursQty: facilityMetricSnapshots.oursQty,
      noOtherBrands: facilityMetricSnapshots.noOtherBrands,
      theirsQty: facilityMetricSnapshots.theirsQty,
      totalQty: facilityMetricSnapshots.totalQty,
      share: facilityMetricSnapshots.share,
      computedAt: facilityMetricSnapshots.computedAt,
    })
    .from(facilityMetricSnapshots)
    .where(
      eq(facilityMetricSnapshots.facilityVerticalProfileId, profileId),
    );
  return row;
}

describe.skipIf(!dbUp)("metric snapshot recompute (database)", () => {
  const NOW = new Date();
  const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000);

  async function recompute(tx: Tx, profileId: number, computedAt = NOW) {
    return new RecomputeMetricSnapshotsUseCase({ database: tx as never }).execute({
      profileId,
      computedAt,
    });
  }

  test("running it fifty times leaves exactly what running it once leaves", async () => {
    await withRollback(async (tx) => {
      const scenario = await seedScenario(tx, "IDEM");
      const ourProduct = await seedProduct(tx, scenario, {
        name: "S-IDEM-OURS",
        metricUnits: "1",
        ownership: "OWN",
        link: true,
      });
      await seedOrder(tx, {
        profileId: scenario.profileId,
        productId: ourProduct,
        quantity: "90",
        orderedAt: daysAgo(1),
      });

      await recompute(tx, scenario.profileId);
      const once = await readSnapshot(tx, scenario.profileId);

      for (let i = 0; i < 49; i += 1) {
        await recompute(tx, scenario.profileId);
      }
      const fifty = await readSnapshot(tx, scenario.profileId);

      expect(fifty!.oursQty).toBe(once!.oursQty);
      expect(fifty!.theirsQty).toBe(once!.theirsQty);
      expect(fifty!.share).toBe(once!.share);
    });
  });

  test("reports how many rows actually moved, so a lost trigger is visible", async () => {
    await withRollback(async (tx) => {
      const scenario = await seedScenario(tx, "DIFF");
      const ourProduct = await seedProduct(tx, scenario, {
        name: "S-DIFF-OURS",
        metricUnits: "1",
        ownership: "OWN",
        link: true,
      });
      await seedOrder(tx, {
        profileId: scenario.profileId,
        productId: ourProduct,
        quantity: "90",
        orderedAt: daysAgo(1),
      });

      const first = await recompute(tx, scenario.profileId);
      expect(first.differed).toBe(1);

      // Nothing changed in between, so a second run must report zero — otherwise
      // `differed` is noise and cannot point at a lost trigger.
      const second = await recompute(tx, scenario.profileId);
      expect(second.written).toBe(1);
      expect(second.differed).toBe(0);
    });
  });

  test("the database computes total and share, so no writer can disagree", async () => {
    await withRollback(async (tx) => {
      const scenario = await seedScenario(tx, "GEN");
      const ourProduct = await seedProduct(tx, scenario, {
        name: "S-GEN-OURS",
        metricUnits: "1",
        ownership: "OWN",
        link: true,
      });
      const theirProduct = await seedProduct(tx, scenario, {
        name: "S-GEN-THEIRS",
        metricUnits: "1",
        ownership: "COMPETITOR",
        link: true,
      });
      await seedOrder(tx, {
        profileId: scenario.profileId,
        productId: ourProduct,
        quantity: "90",
        orderedAt: daysAgo(1),
      });
      await tx.insert(facilityProductUsage).values({
        facilityVerticalProfileId: scenario.profileId,
        definitionId: scenario.definitionId,
        verticalId: scenario.verticalId,
        productId: theirProduct,
        quantity: "10",
      });

      await recompute(tx, scenario.profileId);
      const row = await readSnapshot(tx, scenario.profileId);

      // 90 over 90 days is 30 a month; theirs is the standing 10.
      expect(Number(row!.oursQty)).toBeCloseTo(30, 2);
      expect(Number(row!.theirsQty)).toBeCloseTo(10, 2);
      expect(Number(row!.totalQty)).toBeCloseTo(40, 2);
      expect(Number(row!.share)).toBeCloseTo(30 / 40, 4);
    });
  });

  test("a metric with no data at all gets no row, and the read reports no share", async () => {
    await withRollback(async (tx) => {
      const scenario = await seedScenario(tx, "NULL");
      await seedProduct(tx, scenario, {
        name: "S-NULL-OURS",
        metricUnits: "1",
        ownership: "OWN",
        link: true,
      });

      await recompute(tx, scenario.profileId);

      // No inputs and no stored row means nothing to write — the recompute does
      // not invent a row of zeros for every metric of every clinic.
      expect(await readSnapshot(tx, scenario.profileId)).toBeUndefined();

      // The guarantee that matters is what the rep sees: nothing sold and
      // nothing recorded is not a market we know to be empty.
      const page = await new ListFacilityPotentialsUseCase({
        potentialRepository: new DrizzlePotentialRepository(tx as never),
      }).execute({
        facilityId: scenario.facilityId,
        verticalId: scenario.verticalId,
        scope: { isGlobal: true, assignedVerticalIds: [scenario.verticalId] } as never,
        now: NOW,
      });
      expect(page.items[0]!.share).toBeNull();
    });
  });

  test("a snapshot whose inputs vanish is corrected, not left standing", async () => {
    await withRollback(async (tx) => {
      const scenario = await seedScenario(tx, "GONE");
      const ourProduct = await seedProduct(tx, scenario, {
        name: "S-GONE-OURS",
        metricUnits: "1",
        ownership: "OWN",
        link: true,
      });
      const orderId = await seedOrder(tx, {
        profileId: scenario.profileId,
        productId: ourProduct,
        quantity: "90",
        orderedAt: daysAgo(1),
      });
      await recompute(tx, scenario.profileId);
      expect(Number((await readSnapshot(tx, scenario.profileId))!.oursQty)).toBeCloseTo(30, 2);

      await tx.delete(orderItems).where(eq(orderItems.orderId, orderId));
      await tx.delete(orders).where(eq(orders.id, orderId));
      await recompute(tx, scenario.profileId);

      // Recomputing only metrics that still have inputs would leave yesterday's
      // figure standing and report success.
      expect(Number((await readSnapshot(tx, scenario.profileId))!.oursQty)).toBe(0);
    });
  });

  test("an order older than the window does not count", async () => {
    await withRollback(async (tx) => {
      const scenario = await seedScenario(tx, "WIN");
      const ourProduct = await seedProduct(tx, scenario, {
        name: "S-WIN-OURS",
        metricUnits: "1",
        ownership: "OWN",
        link: true,
      });
      // One inside the 90 days, one comfortably outside it.
      await seedOrder(tx, {
        profileId: scenario.profileId,
        productId: ourProduct,
        quantity: "90",
        orderedAt: daysAgo(10),
      });
      await seedOrder(tx, {
        profileId: scenario.profileId,
        productId: ourProduct,
        quantity: "900",
        orderedAt: daysAgo(120),
      });

      await recompute(tx, scenario.profileId);
      const row = await readSnapshot(tx, scenario.profileId);

      // Only the recent 90 counts: 90/90 × 30 = 30.
      expect(Number(row!.oursQty)).toBeCloseTo(30, 2);
    });
  });

  test("the value does not shift with the time of day it is computed", async () => {
    await withRollback(async (tx) => {
      const scenario = await seedScenario(tx, "STABLE");
      const ourProduct = await seedProduct(tx, scenario, {
        name: "S-STABLE-OURS",
        metricUnits: "1",
        ownership: "OWN",
        link: true,
      });
      await seedOrder(tx, {
        profileId: scenario.profileId,
        productId: ourProduct,
        quantity: "90",
        orderedAt: daysAgo(10),
      });

      await recompute(tx, scenario.profileId, NOW);
      const morning = await readSnapshot(tx, scenario.profileId);
      await recompute(tx, scenario.profileId, new Date(NOW.getTime() + 6 * 3_600_000));
      const evening = await readSnapshot(tx, scenario.profileId);

      // The window slides by hours, but nothing entered or left it.
      expect(evening!.oursQty).toBe(morning!.oursQty);
    });
  });

  test("metric_units is an information field and never multiplies", async () => {
    await withRollback(async (tx) => {
      const scenario = await seedScenario(tx, "UNITS");
      const ourProduct = await seedProduct(tx, scenario, {
        name: "S-UNITS-OURS",
        // A box of five, under the old rule this would have counted as 450.
        metricUnits: "5",
        ownership: "OWN",
        link: true,
      });
      await seedOrder(tx, {
        profileId: scenario.profileId,
        productId: ourProduct,
        quantity: "90",
        orderedAt: daysAgo(1),
      });

      await recompute(tx, scenario.profileId);
      const row = await readSnapshot(tx, scenario.profileId);

      // §4.6: raw quantities. Safe only while a metric's products share a unit.
      expect(Number(row!.oursQty)).toBeCloseTo(30, 2);
    });
  });

  test("orders but no competitor observation reports unknown, not 100%", async () => {
    await withRollback(async (tx) => {
      const scenario = await seedScenario(tx, "UNKNOWN");
      const ourProduct = await seedProduct(tx, scenario, {
        name: "S-UNKNOWN-OURS",
        metricUnits: "1",
        ownership: "OWN",
        link: true,
      });
      await seedOrder(tx, {
        profileId: scenario.profileId,
        productId: ourProduct,
        quantity: "90",
        orderedAt: daysAgo(1),
      });

      await recompute(tx, scenario.profileId);
      const row = await readSnapshot(tx, scenario.profileId);

      // Reporting 100% here would claim we own a market nobody has looked at.
      expect(row!.share).toBeNull();
      expect(Number(row!.oursQty)).toBeCloseTo(30, 2);
    });
  });

  test("the rep's claim is what makes a 100% share legitimate", async () => {
    await withRollback(async (tx) => {
      const scenario = await seedScenario(tx, "CLAIM");
      const ourProduct = await seedProduct(tx, scenario, {
        name: "S-CLAIM-OURS",
        metricUnits: "1",
        ownership: "OWN",
        link: true,
      });
      await seedOrder(tx, {
        profileId: scenario.profileId,
        productId: ourProduct,
        quantity: "90",
        orderedAt: daysAgo(1),
      });
      await recompute(tx, scenario.profileId);
      expect((await readSnapshot(tx, scenario.profileId))!.share).toBeNull();

      await new DrizzlePotentialRepository(tx as never).setNoOtherBrands({
        profileId: scenario.profileId,
        definitionId: scenario.definitionId,
        verticalId: scenario.verticalId,
        value: true,
      });
      await recompute(tx, scenario.profileId);

      // Someone looked and said there is nothing else. Now 100% is a fact.
      const row = await readSnapshot(tx, scenario.profileId);
      expect(Number(row!.share)).toBeCloseTo(1, 6);
      expect(row!.noOtherBrands).toBe(true);
    });
  });

  test("a recompute never erases the rep's claim", async () => {
    await withRollback(async (tx) => {
      // The claim is an input living on a derived row. A recompute that wrote it
      // would throw away a person's assertion to refresh a cache, and the upsert
      // is written to touch only the computed columns.
      const scenario = await seedScenario(tx, "KEEP");
      await seedProduct(tx, scenario, {
        name: "S-KEEP-OURS",
        metricUnits: "1",
        ownership: "OWN",
        link: true,
      });
      await new DrizzlePotentialRepository(tx as never).setNoOtherBrands({
        profileId: scenario.profileId,
        definitionId: scenario.definitionId,
        verticalId: scenario.verticalId,
        value: true,
      });

      for (let i = 0; i < 5; i += 1) {
        await recompute(tx, scenario.profileId);
      }

      expect((await readSnapshot(tx, scenario.profileId))!.noOtherBrands).toBe(true);
    });
  });

  test("a competitor stops counting when it no longer matches a linked product", async () => {
    await withRollback(async (tx) => {
      const scenario = await seedScenario(tx, "UNLINK");
      const theirProduct = await seedProduct(tx, scenario, {
        name: "S-UNLINK-THEIRS",
        metricUnits: "1",
        ownership: "COMPETITOR",
        link: true,
      });
      await tx.insert(facilityProductUsage).values({
        facilityVerticalProfileId: scenario.profileId,
        definitionId: scenario.definitionId,
        verticalId: scenario.verticalId,
        productId: theirProduct,
        quantity: "10",
      });
      await recompute(tx, scenario.profileId);
      expect(Number((await readSnapshot(tx, scenario.profileId))!.theirsQty)).toBeCloseTo(10, 2);

      // Drop the equivalence that made it count. Same effect as unlinking the
      // product of ours it stood against.
      await tx
        .delete(productEquivalences)
        .where(eq(productEquivalences.competitorProductId, theirProduct));
      await recompute(tx, scenario.profileId);

      // Matches our own side, which has always joined the link table. The usage
      // row survives and counts again if the equivalence comes back.
      expect(Number((await readSnapshot(tx, scenario.profileId))!.theirsQty)).toBe(0);
    });
  });

  test("the share a clinic reports is what the read path returns", async () => {
    await withRollback(async (tx) => {
      const scenario = await seedScenario(tx, "READ");
      const ourProduct = await seedProduct(tx, scenario, {
        name: "S-READ-OURS",
        metricUnits: "1",
        ownership: "OWN",
        link: true,
      });
      const theirProduct = await seedProduct(tx, scenario, {
        name: "S-READ-THEIRS",
        metricUnits: "1",
        ownership: "COMPETITOR",
        link: true,
      });
      await seedOrder(tx, {
        profileId: scenario.profileId,
        productId: ourProduct,
        quantity: "90",
        orderedAt: daysAgo(1),
      });
      await tx.insert(facilityProductUsage).values({
        facilityVerticalProfileId: scenario.profileId,
        definitionId: scenario.definitionId,
        verticalId: scenario.verticalId,
        productId: theirProduct,
        quantity: "60",
      });

      const page = await new ListFacilityPotentialsUseCase({
        potentialRepository: new DrizzlePotentialRepository(tx as never),
      }).execute({
        facilityId: scenario.facilityId,
        verticalId: scenario.verticalId,
        scope: { isGlobal: true, assignedVerticalIds: [scenario.verticalId] } as never,
        now: NOW,
      });

      // The screen and the stored value must answer the same question the same
      // way — they disagreed for as long as one averaged months and the other
      // did not.
      expect(page.items[0]!.competitorMonthlyQty).toBeCloseTo(60, 2);
      expect(page.items[0]!.share).toBeCloseTo(30 / 90, 4);
    });
  });
});
