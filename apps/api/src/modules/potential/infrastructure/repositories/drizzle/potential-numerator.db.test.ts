import { describe, expect, test } from "bun:test";
import {
  businessVerticals,
  facilities,
  facilityVerticalProfiles,
  municipalities,
  orderItems,
  orders,
  productPotentialDefinitions,
  productPotentialLinks,
  products,
  states,
} from "@atlasmed/database";
import { isDatabaseReachable, withRollback } from "../../../../../test-utils/db-harness";
import { DrizzlePotentialRepository } from "./drizzle-potential.repository";

/**
 * The penetration numerator, against a real Postgres (spec 0013 §4.2–4.3).
 *
 * Three defects lived in one query and all three were invisible: quantities
 * were summed in product units so a box of five counted as one; `CONSIGNMENT`
 * was excluded while the funnel counted it; and a product sold in two linhas
 * would contribute to both metrics once links became per-vertical.
 *
 * None of them errored. They produced a number that was simply too small, and
 * plausible enough that nobody questioned it — which is why this is asserted
 * against real rows rather than a query-shape fake.
 */
const dbUp = await isDatabaseReachable();

type Tx = Parameters<Parameters<typeof withRollback>[0]>[0];

async function seedScenario(tx: Tx, suffix: string) {
  const [state] = await tx
    .insert(states)
    .values({ name: `T-${suffix}`, ibgeId: `9${suffix}`, abbreviation: `T${suffix}` })
    .returning({ id: states.id });
  const [municipality] = await tx
    .insert(municipalities)
    .values({ stateId: state!.id, name: `T-${suffix}`, ibgeId: `99${suffix}999` })
    .returning({ id: municipalities.id });
  const [facility] = await tx
    .insert(facilities)
    .values({
      displayName: `T-CLINIC-${suffix}`,
      legalDocumentType: "CNPJ",
      stateId: state!.id,
      municipalityId: municipality!.id,
    })
    .returning({ id: facilities.id });
  const [vertical] = await tx
    .insert(businessVerticals)
    .values({ code: `T-NUM-${suffix}`, name: `T-NUM-${suffix}` })
    .returning({ id: businessVerticals.id });
  const [profile] = await tx
    .insert(facilityVerticalProfiles)
    .values({ facilityId: facility!.id, verticalId: vertical!.id })
    .returning({ id: facilityVerticalProfiles.id });
  const [definition] = await tx
    .insert(productPotentialDefinitions)
    .values({ verticalId: vertical!.id, key: `t-num-${suffix}`, label: "Ampolas" })
    .returning({ id: productPotentialDefinitions.id });

  return {
    facilityId: facility!.id,
    verticalId: vertical!.id,
    profileId: profile!.id,
    definitionId: definition!.id,
  };
}

async function seedLinkedProduct(
  tx: Tx,
  scenario: { verticalId: number; definitionId: number },
  name: string,
  metricUnits: string
) {
  const [product] = await tx
    .insert(products)
    .values({
      name,
      manufacturer: "T-Manufacturer",
      countryOfOrigin: "BR",
      price17: "1",
      price18: "1",
      price20: "1",
      metricUnits,
      ownership: "OWN",
    })
    .returning({ id: products.id });
  await tx.insert(productPotentialLinks).values({
    productId: product!.id,
    definitionId: scenario.definitionId,
    verticalId: scenario.verticalId,
  });
  return product!.id;
}

async function seedOrderLine(
  tx: Tx,
  input: {
    profileId: number;
    productId: number;
    quantity: string;
    type: "SALE" | "CONSIGNMENT";
    status: "APPROVED" | "INVOICED" | "DRAFT";
  }
) {
  const [order] = await tx
    .insert(orders)
    .values({
      facilityVerticalProfileId: input.profileId,
      orderedAt: new Date(),
      type: input.type,
      status: input.status,
    })
    .returning({ id: orders.id });
  await tx.insert(orderItems).values({
    orderId: order!.id,
    productId: input.productId,
    quantity: input.quantity,
  });
}

/** Far enough back that "since" never excludes the seeded orders. */
const SINCE = new Date(Date.now() - 90 * 86_400_000);

describe.skipIf(!dbUp)("penetration numerator (database)", () => {
  test("ten boxes of five count as fifty, not ten", async () => {
    await withRollback(async (tx) => {
      const scenario = await seedScenario(tx, "BOX");
      const productId = await seedLinkedProduct(tx, scenario, "T-BOX-OF-5", "5");

      await seedOrderLine(tx, {
        profileId: scenario.profileId,
        productId,
        quantity: "10",
        type: "SALE",
        status: "APPROVED",
      });

      const [sum] = await new DrizzlePotentialRepository(
        tx as never
      ).sumAtlasmedQtyByDefinition({
        facilityId: scenario.facilityId,
        verticalId: scenario.verticalId,
        definitionIds: [scenario.definitionId],
        since: SINCE,
      });

      // Spec 0013 §9.1, the headline acceptance criterion.
      expect(sum?.totalQty).toBe(50);
    });
  });

  test("consigned stock counts toward the market, like the funnel already counts it", async () => {
    await withRollback(async (tx) => {
      const scenario = await seedScenario(tx, "CON");
      const productId = await seedLinkedProduct(tx, scenario, "T-CONSIGNED", "1");

      await seedOrderLine(tx, {
        profileId: scenario.profileId,
        productId,
        quantity: "7",
        type: "SALE",
        status: "APPROVED",
      });
      await seedOrderLine(tx, {
        profileId: scenario.profileId,
        productId,
        quantity: "3",
        type: "CONSIGNMENT",
        status: "INVOICED",
      });
      // Still excluded: a draft is not revenue.
      await seedOrderLine(tx, {
        profileId: scenario.profileId,
        productId,
        quantity: "100",
        type: "SALE",
        status: "DRAFT",
      });

      const [sum] = await new DrizzlePotentialRepository(
        tx as never
      ).sumAtlasmedQtyByDefinition({
        facilityId: scenario.facilityId,
        verticalId: scenario.verticalId,
        definitionIds: [scenario.definitionId],
        since: SINCE,
      });

      expect(sum?.totalQty).toBe(10);
    });
  });

  test("a linha's numerator ignores another linha's sales of the same product", async () => {
    await withRollback(async (tx) => {
      const orto = await seedScenario(tx, "V1");

      // The same clinic, a second linha, its own metric — and the same product
      // linked in both, which 0086 now permits.
      const [derma] = await tx
        .insert(businessVerticals)
        .values({ code: "T-NUM-V2", name: "T-NUM-V2" })
        .returning({ id: businessVerticals.id });
      const [dermaProfile] = await tx
        .insert(facilityVerticalProfiles)
        .values({ facilityId: orto.facilityId, verticalId: derma!.id })
        .returning({ id: facilityVerticalProfiles.id });
      const [dermaDefinition] = await tx
        .insert(productPotentialDefinitions)
        .values({ verticalId: derma!.id, key: "t-num-v2", label: "Seringas" })
        .returning({ id: productPotentialDefinitions.id });

      const productId = await seedLinkedProduct(tx, orto, "T-BOTH-LINHAS", "1");
      await tx.insert(productPotentialLinks).values({
        productId,
        definitionId: dermaDefinition!.id,
        verticalId: derma!.id,
      });

      await seedOrderLine(tx, {
        profileId: orto.profileId,
        productId,
        quantity: "4",
        type: "SALE",
        status: "APPROVED",
      });
      await seedOrderLine(tx, {
        profileId: dermaProfile!.id,
        productId,
        quantity: "9",
        type: "SALE",
        status: "APPROVED",
      });

      const [sum] = await new DrizzlePotentialRepository(
        tx as never
      ).sumAtlasmedQtyByDefinition({
        facilityId: orto.facilityId,
        verticalId: orto.verticalId,
        definitionIds: [orto.definitionId],
        since: SINCE,
      });

      // 4, not 13 — the Dermatologia order belongs to the other metric.
      expect(sum?.totalQty).toBe(4);
    });
  });
});
