import { describe, expect, it } from "bun:test";
import { DrizzleOrderRepository } from "./drizzle-order.repository";

const createInput = {
  facilityId: "facility-1",
  verticalId: "vertical-1",
  sellerId: "rep-1",
  items: [{ productId: "product-1", quantity: 1, unitPrice: 100 }],
};

describe("DrizzleOrderRepository idempotency", () => {
  it("acquires the transaction advisory lock before reading receipts or inserting orders", async () => {
    const events: string[] = [];
    const tx = {
      execute: async () => {
        events.push("lock");
      },
      select: () => {
        events.push("receipt-read");
        return {
          from: () => ({
            where: () => ({
              limit: async () => [{
                requestFingerprint: "different-fingerprint",
                result: {},
              }],
            }),
          }),
        };
      },
      insert: () => {
        events.push("insert");
        throw new Error("insert must not run for an existing receipt");
      },
    };
    const database = {
      transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
    };
    const repository = new DrizzleOrderRepository(database as never);

    await expect(repository.createIdempotently(
      "rep-1",
      "order-key",
      "new-fingerprint",
      createInput,
    )).resolves.toEqual({ kind: "mismatch" });

    expect(events).toEqual(["lock", "receipt-read"]);
  });
});
