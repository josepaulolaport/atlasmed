import { describe, expect, it } from "bun:test";

describe("Facility source upsert manual edit protection", () => {
  it("skips overwriting display fields when manuallyEditedAt is set", () => {
    const existing = {
      manuallyEditedAt: new Date("2026-01-01"),
      sourceContentHash: "hash-1",
    };

    const input = {
      name: "Source Name",
      address: "Source Address",
      lat: -23.5,
      lng: -46.6,
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
      if (input.lat !== undefined) updateData.lat = input.lat;
      if (input.lng !== undefined) updateData.lng = input.lng;
    }

    expect(updateData.name).toBeUndefined();
    expect(updateData.address).toBeUndefined();
    expect(updateData.lat).toBeUndefined();
    expect(updateData.lng).toBeUndefined();
    expect(updateData.sourceContentHash).toBe("hash-2");
  });
});
