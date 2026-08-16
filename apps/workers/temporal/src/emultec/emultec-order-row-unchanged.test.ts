import { describe, expect, test } from "bun:test";
import {
  displacedProfileId,
  emultecOrderItemRowUnchanged,
  emultecOrderRowUnchanged,
  type EmultecOrderItemRow,
  type EmultecOrderRow,
} from "./import-emultec-orders";

/**
 * Guards the "don't write a row we are about to overwrite with itself" check.
 *
 * The consequence of getting this wrong is invisible rather than loud: an
 * UPDATE bumps `orders.updated_at` through `$onUpdate`, which is exactly what
 * the purchase-recurrence reconcile selects changed facilities by. A comparison
 * that always reports "changed" therefore turns every routine re-read — the
 * RECONCILE date window, DLQ replay, SKIP_RECHECK — into a full recurrence
 * recalculation and search republish for every clinic it touched, while looking
 * perfectly healthy in the run digest.
 */
function orderRow(overrides: Partial<EmultecOrderRow> = {}): EmultecOrderRow {
  return {
    facilityVerticalProfileId: 10,
    sellerId: 3,
    personId: null,
    status: "INVOICED",
    type: "SALE",
    orderedAt: new Date("2026-03-04T12:00:00.000Z"),
    notes: null,
    freight: "1.00",
    grossWeight: "2.50",
    netWeight: "2.00",
    ...overrides,
  };
}

function itemRow(
  overrides: Partial<EmultecOrderItemRow> = {}
): EmultecOrderItemRow {
  return {
    orderId: 77,
    productId: 5,
    idProdutoEmultec: 4242,
    quantity: "3.000",
    unitPrice: "1250.00",
    ...overrides,
  };
}

describe("emultecOrderRowUnchanged", () => {
  test("an identical row is unchanged", () => {
    expect(emultecOrderRowUnchanged(orderRow(), orderRow())).toBe(true);
  });

  test("numeric scale differences are not changes", () => {
    // Postgres returns `numeric` at the column's scale; the importer builds the
    // value with String(1). Comparing those as text reports a change on every
    // row and silently defeats the whole check.
    const existing = orderRow({
      freight: "1.00",
      grossWeight: "2.50",
      netWeight: "0.000",
    });
    const desired = orderRow({
      freight: "1",
      grossWeight: "2.5",
      netWeight: "0",
    });
    expect(emultecOrderRowUnchanged(existing, desired)).toBe(true);
  });

  test("an equal timestamp from a different Date instance is not a change", () => {
    const existing = orderRow({
      orderedAt: new Date("2026-03-04T12:00:00.000Z"),
    });
    const desired = orderRow({
      orderedAt: new Date("2026-03-04T12:00:00.000Z"),
    });
    expect(emultecOrderRowUnchanged(existing, desired)).toBe(true);
  });

  test.each([
    ["facilityVerticalProfileId", { facilityVerticalProfileId: 11 }],
    ["sellerId", { sellerId: 4 }],
    ["personId", { personId: 9 }],
    ["status", { status: "CANCELLED" }],
    ["type", { type: "DONATION" }],
    ["orderedAt", { orderedAt: new Date("2026-03-05T12:00:00.000Z") }],
    ["notes", { notes: "changed" }],
    ["freight", { freight: "2.00" }],
    ["grossWeight", { grossWeight: "9.00" }],
    ["netWeight", { netWeight: "9.00" }],
  ] as const)("a different %s is a change", (_field, override) => {
    expect(
      emultecOrderRowUnchanged(orderRow(), orderRow(override))
    ).toBe(false);
  });

  test("null and a value are not equal in either direction", () => {
    expect(
      emultecOrderRowUnchanged(
        orderRow({ freight: null }),
        orderRow({ freight: "1.00" })
      )
    ).toBe(false);
    expect(
      emultecOrderRowUnchanged(
        orderRow({ freight: "1.00" }),
        orderRow({ freight: null })
      )
    ).toBe(false);
    // Two nulls agree — a column Emultec never fills must not look like churn.
    expect(
      emultecOrderRowUnchanged(
        orderRow({ freight: null }),
        orderRow({ freight: null })
      )
    ).toBe(true);
  });

  test("every column the importer writes is compared", () => {
    // A field added to the UPDATE but not to the comparison is a change the
    // importer would swallow, so flipping any one field must be detected.
    const baseline = orderRow();
    for (const key of Object.keys(baseline) as Array<keyof EmultecOrderRow>) {
      const mutated = orderRow();
      const value = baseline[key];
      if (value instanceof Date) {
        mutated[key] = new Date(value.getTime() + 86_400_000) as never;
      } else if (typeof value === "number") {
        mutated[key] = (value + 1) as never;
      } else if (typeof value === "string") {
        mutated[key] = `${value}-x` as never;
      } else {
        mutated[key] = 12_345 as never;
      }
      expect(emultecOrderRowUnchanged(baseline, mutated)).toBe(false);
    }
  });
});

describe("emultecOrderItemRowUnchanged", () => {
  test("an identical line is unchanged", () => {
    expect(emultecOrderItemRowUnchanged(itemRow(), itemRow())).toBe(true);
  });

  test("numeric scale differences are not changes", () => {
    expect(
      emultecOrderItemRowUnchanged(
        itemRow({ quantity: "3.000", unitPrice: "1250.00" }),
        itemRow({ quantity: "3", unitPrice: "1250" })
      )
    ).toBe(true);
  });

  test("every column the importer writes is compared", () => {
    const baseline = itemRow();
    for (const key of Object.keys(baseline) as Array<
      keyof EmultecOrderItemRow
    >) {
      const mutated = itemRow();
      const value = baseline[key];
      mutated[key] = (
        typeof value === "number" ? value + 1 : `${value}9`
      ) as never;
      expect(emultecOrderItemRowUnchanged(baseline, mutated)).toBe(false);
    }
  });
});

/**
 * An order that changes clinics leaves the old one holding a purchase it no
 * longer has. Reconciliation reaches a facility by joining an order to its
 * profile, so the destination is found and the origin is reachable from nothing
 * — its `last_valid_purchase_date` and funnel stage go on counting the order
 * until a full sweep happens to recompute it.
 */
describe("displacedProfileId", () => {
  const base: EmultecOrderRow = {
    facilityVerticalProfileId: 10,
    sellerId: 1,
    personId: null,
    status: "INVOICED",
    type: "SALE",
    orderedAt: new Date("2026-08-15T12:00:00.000Z"),
    notes: null,
    freight: "0",
    grossWeight: "0",
    netWeight: "0",
  };

  test("names the profile an order moved away from", () => {
    // The real shape: an avulsa first resolved to the surgeon's own CPF
    // facility, then moved to the clinic once the CNPJ link existed.
    expect(displacedProfileId(base, { ...base, facilityVerticalProfileId: 20 })).toBe(10);
  });

  test("names nothing when only other columns changed", () => {
    expect(displacedProfileId(base, { ...base, notes: "revised" })).toBeNull();
  });

  test("names nothing when the row is identical", () => {
    expect(displacedProfileId(base, { ...base })).toBeNull();
  });
});
