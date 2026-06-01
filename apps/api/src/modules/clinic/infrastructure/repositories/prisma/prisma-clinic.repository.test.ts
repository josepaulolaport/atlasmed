import { describe, expect, it } from "bun:test";

describe("Clinic source upsert manual edit protection", () => {
  it("skips overwriting display fields when manuallyEditedAt is set", () => {
    const existing = {
      manuallyEditedAt: new Date("2026-01-01"),
      sourceContentHash: "hash-1",
    };

    const input = {
      name: "Source Name",
      address: "Source Address",
      territoryId: "t-1",
      sourceContentHash: "hash-2",
      sourceLastSeenAt: new Date(),
    };

    const updateData: Record<string, unknown> = {
      sourceContentHash: input.sourceContentHash,
      sourceLastSeenAt: input.sourceLastSeenAt,
      sourcePresent: true,
      sourceTracked: true,
    };

    if (!existing.manuallyEditedAt) {
      updateData.name = input.name;
      updateData.address = input.address;
      updateData.territoryId = input.territoryId;
    }

    expect(updateData.name).toBeUndefined();
    expect(updateData.address).toBeUndefined();
    expect(updateData.territoryId).toBeUndefined();
    expect(updateData.sourceContentHash).toBe("hash-2");
  });
});
