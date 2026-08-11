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
  productPotentialLinks,
  products,
  states,
} from "@atlasmed/database";
import { monthKeyAt } from "@atlasmed/facility-insights";
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
  if (input.link) {
    await tx.insert(productPotentialLinks).values({
      productId: product!.id,
      definitionId: scenario.definitionId,
      verticalId: scenario.verticalId,
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

async function readSnapshot(tx: Tx, profileId: number, month: string) {
  const [row] = await tx
    .select({
      oursQty: facilityMetricSnapshots.oursQty,
      theirsQty: facilityMetricSnapshots.theirsQty,
      totalQty: facilityMetricSnapshots.totalQty,
      share: facilityMetricSnapshots.share,
      computedAt: facilityMetricSnapshots.computedAt,
    })
    .from(facilityMetricSnapshots)
    .where(
      and(
        eq(facilityMetricSnapshots.facilityVerticalProfileId, profileId),
        eq(facilityMetricSnapshots.month, month),
      ),
    );
  return row;
}

describe.skipIf(!dbUp)("metric snapshot recompute (database)", () => {
  test("running it fifty times leaves exactly what running it once leaves", async () => {
    await withRollback(async (tx) => {
      const scenario = await seedScenario(tx, "IDEM");
      const ourProduct = await seedProduct(tx, scenario, {
        name: "S-OURS",
        metricUnits: "5",
        ownership: "OWN",
        link: true,
      });
      const theirProduct = await seedProduct(tx, scenario, {
        name: "S-THEIRS",
        metricUnits: "2",
        ownership: "COMPETITOR",
        link: false,
      });

      await seedOrder(tx, {
        profileId: scenario.profileId,
        productId: ourProduct,
        quantity: "10",
        orderedAt: new Date("2026-03-10T12:00:00.000Z"),
      });
      await tx.insert(facilityProductUsage).values({
        facilityVerticalProfileId: scenario.profileId,
        definitionId: scenario.definitionId,
        verticalId: scenario.verticalId,
        productId: theirProduct,
        month: "2026-03-01",
        quantity: "25",
      });

      const useCase = new RecomputeMetricSnapshotsUseCase({ database: tx as never });

      const computedAt = new Date("2026-04-01T00:00:00.000Z");
      await useCase.execute({
        profileId: scenario.profileId,
        months: ["2026-03-01"],
        computedAt,
      });
      const afterFirst = await readSnapshot(tx, scenario.profileId, "2026-03-01");

      for (let run = 0; run < 49; run += 1) {
        await useCase.execute({
          profileId: scenario.profileId,
          months: ["2026-03-01"],
          computedAt,
        });
      }
      const afterFifty = await readSnapshot(tx, scenario.profileId, "2026-03-01");

      // 10 boxes × 5 = 50 ours; 25 units × 2 = 50 theirs.
      expect(afterFirst?.oursQty).toBe("50.00");
      expect(afterFirst?.theirsQty).toBe("50.00");
      expect(afterFifty).toEqual(afterFirst!);

      const all = await tx
        .select({ month: facilityMetricSnapshots.month })
        .from(facilityMetricSnapshots)
        .where(eq(facilityMetricSnapshots.facilityVerticalProfileId, scenario.profileId));
      expect(all).toHaveLength(1);
    });
  });

  test("reports how many rows actually moved, so a lost trigger is visible", async () => {
    await withRollback(async (tx) => {
      const scenario = await seedScenario(tx, "DIFF");
      const ourProduct = await seedProduct(tx, scenario, {
        name: "S-DIFF",
        metricUnits: "1",
        ownership: "OWN",
        link: true,
      });
      await seedOrder(tx, {
        profileId: scenario.profileId,
        productId: ourProduct,
        quantity: "5",
        orderedAt: new Date("2026-03-10T12:00:00.000Z"),
      });

      const useCase = new RecomputeMetricSnapshotsUseCase({ database: tx as never });

      // First run: the row is new, so it counts as a difference.
      const first = await useCase.execute({
        profileId: scenario.profileId,
        months: ["2026-03-01"],
      });
      expect(first.written).toBe(1);
      expect(first.differed).toBe(1);

      // Nothing changed in between — a sweep here must report a clean run,
      // otherwise "differed" is noise and nobody will trust it.
      const second = await useCase.execute({
        profileId: scenario.profileId,
        months: ["2026-03-01"],
      });
      expect(second.written).toBe(1);
      expect(second.differed).toBe(0);

      // An order lands without the trigger firing. The sweep must notice.
      await seedOrder(tx, {
        profileId: scenario.profileId,
        productId: ourProduct,
        quantity: "7",
        orderedAt: new Date("2026-03-11T12:00:00.000Z"),
      });
      const third = await useCase.execute({
        profileId: scenario.profileId,
        months: ["2026-03-01"],
      });
      expect(third.differed).toBe(1);
      expect((await readSnapshot(tx, scenario.profileId, "2026-03-01"))?.oursQty).toBe("12.00");
    });
  });

  test("the database computes total and share, so no writer can disagree", async () => {
    await withRollback(async (tx) => {
      const scenario = await seedScenario(tx, "SHARE");
      const ourProduct = await seedProduct(tx, scenario, {
        name: "S-SHARE-OURS",
        metricUnits: "1",
        ownership: "OWN",
        link: true,
      });
      const theirProduct = await seedProduct(tx, scenario, {
        name: "S-SHARE-THEIRS",
        metricUnits: "1",
        ownership: "COMPETITOR",
        link: false,
      });

      await seedOrder(tx, {
        profileId: scenario.profileId,
        productId: ourProduct,
        quantity: "30",
        orderedAt: new Date("2026-03-10T12:00:00.000Z"),
      });
      await tx.insert(facilityProductUsage).values({
        facilityVerticalProfileId: scenario.profileId,
        definitionId: scenario.definitionId,
        verticalId: scenario.verticalId,
        productId: theirProduct,
        month: "2026-03-01",
        quantity: "10",
      });

      await new RecomputeMetricSnapshotsUseCase({ database: tx as never }).execute({ profileId: scenario.profileId, months: ["2026-03-01"] });

      const row = await readSnapshot(tx, scenario.profileId, "2026-03-01");
      expect(row?.totalQty).toBe("40.00");
      expect(Number(row?.share)).toBeCloseTo(0.75, 8);
    });
  });

  test("a month with no data at all yields share NULL, not zero", async () => {
    await withRollback(async (tx) => {
      const scenario = await seedScenario(tx, "NULL");
      const ourProduct = await seedProduct(tx, scenario, {
        name: "S-NULL-OURS",
        metricUnits: "1",
        ownership: "OWN",
        link: true,
      });
      // An order in March only — February is genuinely unknown.
      await seedOrder(tx, {
        profileId: scenario.profileId,
        productId: ourProduct,
        quantity: "5",
        orderedAt: new Date("2026-03-10T12:00:00.000Z"),
      });

      await new RecomputeMetricSnapshotsUseCase({ database: tx as never }).execute({ profileId: scenario.profileId, months: ["2026-02-01", "2026-03-01"] });

      // February has no inputs, so no row is written — absence is the "unknown".
      expect(await readSnapshot(tx, scenario.profileId, "2026-02-01")).toBeUndefined();
      expect(await readSnapshot(tx, scenario.profileId, "2026-03-01")).toBeDefined();
    });
  });

  test("a snapshot whose inputs vanish is corrected, not left standing", async () => {
    await withRollback(async (tx) => {
      const scenario = await seedScenario(tx, "VANISH");
      const ourProduct = await seedProduct(tx, scenario, {
        name: "S-VANISH",
        metricUnits: "1",
        ownership: "OWN",
        link: true,
      });
      const orderId = await seedOrder(tx, {
        profileId: scenario.profileId,
        productId: ourProduct,
        quantity: "12",
        orderedAt: new Date("2026-03-10T12:00:00.000Z"),
      });

      const useCase = new RecomputeMetricSnapshotsUseCase({ database: tx as never });
      await useCase.execute({ profileId: scenario.profileId, months: ["2026-03-01"] });
      expect((await readSnapshot(tx, scenario.profileId, "2026-03-01"))?.oursQty).toBe("12.00");

      // The order is cancelled outright. Recomputing only the cells that still
      // have inputs would leave 12.00 standing and report success.
      await tx.delete(orderItems).where(eq(orderItems.orderId, orderId));
      await tx.delete(orders).where(eq(orders.id, orderId));

      await useCase.execute({ profileId: scenario.profileId, months: ["2026-03-01"] });

      const row = await readSnapshot(tx, scenario.profileId, "2026-03-01");
      expect(row?.oursQty).toBe("0.00");
      expect(row?.share).toBeNull();
    });
  });

  test("recomputing one month does not disturb another", async () => {
    await withRollback(async (tx) => {
      const scenario = await seedScenario(tx, "ISO");
      const ourProduct = await seedProduct(tx, scenario, {
        name: "S-ISO",
        metricUnits: "1",
        ownership: "OWN",
        link: true,
      });
      await seedOrder(tx, {
        profileId: scenario.profileId,
        productId: ourProduct,
        quantity: "4",
        orderedAt: new Date("2026-01-10T12:00:00.000Z"),
      });
      await seedOrder(tx, {
        profileId: scenario.profileId,
        productId: ourProduct,
        quantity: "9",
        orderedAt: new Date("2026-02-10T12:00:00.000Z"),
      });

      const useCase = new RecomputeMetricSnapshotsUseCase({ database: tx as never });
      await useCase.execute({
        profileId: scenario.profileId,
        months: ["2026-01-01", "2026-02-01"],
      });

      const januaryBefore = await readSnapshot(tx, scenario.profileId, "2026-01-01");
      await useCase.execute({ profileId: scenario.profileId, months: ["2026-02-01"] });
      const januaryAfter = await readSnapshot(tx, scenario.profileId, "2026-01-01");

      expect(januaryAfter).toEqual(januaryBefore!);
      expect(januaryAfter?.oursQty).toBe("4.00");
    });
  });

  test("an order in a neighbouring month never lands in this one", async () => {
    await withRollback(async (tx) => {
      const scenario = await seedScenario(tx, "TZSNAP");
      const ourProduct = await seedProduct(tx, scenario, {
        name: "S-TZ",
        metricUnits: "1",
        ownership: "OWN",
        link: true,
      });
      // 31 March 22:00 São Paulo, which is 1 April 01:00 UTC.
      await seedOrder(tx, {
        profileId: scenario.profileId,
        productId: ourProduct,
        quantity: "8",
        orderedAt: new Date("2026-04-01T01:00:00.000Z"),
      });

      await new RecomputeMetricSnapshotsUseCase({ database: tx as never }).execute({ profileId: scenario.profileId, months: ["2026-03-01", "2026-04-01"] });

      expect((await readSnapshot(tx, scenario.profileId, "2026-03-01"))?.oursQty).toBe("8.00");
      expect(await readSnapshot(tx, scenario.profileId, "2026-04-01")).toBeUndefined();
    });
  });
});

describe.skipIf(!dbUp)("read path rolling window (database)", () => {
  test("the monthly rate does not shift with where in the month it is read", async () => {
    await withRollback(async (tx) => {
      const scenario = await seedScenario(tx, "READ");
      const ourProduct = await seedProduct(tx, scenario, {
        name: "S-READ",
        metricUnits: "1",
        ownership: "OWN",
        link: true,
      });
      await seedOrder(tx, {
        profileId: scenario.profileId,
        productId: ourProduct,
        quantity: "9",
        orderedAt: new Date("2026-03-10T12:00:00.000Z"),
      });

      const repository = new DrizzlePotentialRepository(tx as never);
      const now = new Date("2026-03-20T12:00:00.000Z");
      const list = new ListFacilityPotentialsUseCase({ potentialRepository: repository });
      const scope = {
        isGlobal: true,
        assignedVerticalIds: [scenario.verticalId],
      } as never;

      // 9 units inside a 90-day window, normalised to a month: 9/90*30 = 3.
      // The point is that it does not change with where in the month "now"
      // falls — a partial calendar month would have understated it.
      const result = await list.execute({
        facilityId: scenario.facilityId,
        verticalId: scenario.verticalId,
        scope,
        now,
      });
      expect(result.items[0]?.atlasmedMonthlyAvgQty).toBeCloseTo(3, 6);
      // No competitor observation, so the market size is unknown — not 100%.
      expect(result.items[0]?.share).toBeNull();

      // Same order read from the 1st of the month rather than the 20th: the
      // rolling window is unchanged in length, so the rate is unchanged.
      const earlyInMonth = await list.execute({
        facilityId: scenario.facilityId,
        verticalId: scenario.verticalId,
        scope,
        now: new Date("2026-04-01T12:00:00.000Z"),
      });
      expect(earlyInMonth.items[0]?.atlasmedMonthlyAvgQty).toBeCloseTo(3, 6);
    });
  });
});

describe.skipIf(!dbUp)("share only exists when the market is known (database)", () => {
  test("orders but no competitor observation reports unknown, not 100%", async () => {
    await withRollback(async (tx) => {
      const scenario = await seedScenario(tx, "UNK");
      const ourProduct = await seedProduct(tx, scenario, {
        name: "S-UNK",
        metricUnits: "1",
        ownership: "OWN",
        link: true,
      });
      await seedOrder(tx, {
        profileId: scenario.profileId,
        productId: ourProduct,
        quantity: "90",
        orderedAt: new Date(),
      });

      const list = new ListFacilityPotentialsUseCase({
        potentialRepository: new DrizzlePotentialRepository(tx as never),
      });
      const scope = { isGlobal: true, assignedVerticalIds: [scenario.verticalId] } as never;

      const result = await list.execute({
        facilityId: scenario.facilityId,
        verticalId: scenario.verticalId,
        scope,
      });

      // We sell into this clinic and know nothing about the competition. That is
      // not 100% — it is "we have not asked".
      expect(result.items[0]?.atlasmedMonthlyAvgQty).toBeGreaterThan(0);
      expect(result.items[0]?.share).toBeNull();
    });
  });

  test("a recorded competitor makes the share real again", async () => {
    await withRollback(async (tx) => {
      const scenario = await seedScenario(tx, "KNOWN");
      const ourProduct = await seedProduct(tx, scenario, {
        name: "S-KNOWN-OURS",
        metricUnits: "1",
        ownership: "OWN",
        link: true,
      });
      const theirProduct = await seedProduct(tx, scenario, {
        name: "S-KNOWN-THEIRS",
        metricUnits: "1",
        ownership: "COMPETITOR",
        link: false,
      });
      await seedOrder(tx, {
        profileId: scenario.profileId,
        productId: ourProduct,
        quantity: "90",
        orderedAt: new Date(),
      });
      await tx.insert(facilityProductUsage).values({
        facilityVerticalProfileId: scenario.profileId,
        definitionId: scenario.definitionId,
        verticalId: scenario.verticalId,
        productId: theirProduct,
        month: monthKeyAt(new Date()),
        quantity: "60",
      });

      const result = await new ListFacilityPotentialsUseCase({
        potentialRepository: new DrizzlePotentialRepository(tx as never),
      }).execute({
        facilityId: scenario.facilityId,
        verticalId: scenario.verticalId,
        scope: { isGlobal: true, assignedVerticalIds: [scenario.verticalId] } as never,
      });

      // 90 units over 90 days = 30/month ours. Theirs is 60: the rep answers
      // "quantas por mês", so the figure they recorded is the monthly rate and
      // is taken as it stands. It used to be divided by the three-month window
      // — 20/month — which called the two months nobody surveyed hard zeros.
      expect(result.items[0]?.competitorMonthlyQty).toBeCloseTo(60, 4);
      expect(result.items[0]?.share).toBeCloseTo(30 / 90, 4);
    });
  });

  test("a recorded zero is a fact, so the share is 100% and not unknown", async () => {
    await withRollback(async (tx) => {
      const scenario = await seedScenario(tx, "ZERO");
      const ourProduct = await seedProduct(tx, scenario, {
        name: "S-ZERO-OURS",
        metricUnits: "1",
        ownership: "OWN",
        link: true,
      });
      const theirProduct = await seedProduct(tx, scenario, {
        name: "S-ZERO-THEIRS",
        metricUnits: "1",
        ownership: "COMPETITOR",
        link: false,
      });
      await seedOrder(tx, {
        profileId: scenario.profileId,
        productId: ourProduct,
        quantity: "90",
        orderedAt: new Date(),
      });
      // The rep looked and reported none — an observation, not an absence.
      await tx.insert(facilityProductUsage).values({
        facilityVerticalProfileId: scenario.profileId,
        definitionId: scenario.definitionId,
        verticalId: scenario.verticalId,
        productId: theirProduct,
        month: monthKeyAt(new Date()),
        quantity: "0",
      });

      const result = await new ListFacilityPotentialsUseCase({
        potentialRepository: new DrizzlePotentialRepository(tx as never),
      }).execute({
        facilityId: scenario.facilityId,
        verticalId: scenario.verticalId,
        scope: { isGlobal: true, assignedVerticalIds: [scenario.verticalId] } as never,
      });

      expect(result.items[0]?.share).toBe(1);
    });
  });
});
