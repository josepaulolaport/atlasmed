import { describe, expect, it } from "bun:test";
import { DrizzleOrderRepository } from "./drizzle-order.repository";

describe("DrizzleOrderRepository", () => {
  it("exposes create for order persistence", () => {
    const repository = new DrizzleOrderRepository({} as never);
    expect(typeof repository.create).toBe("function");
  });
});
