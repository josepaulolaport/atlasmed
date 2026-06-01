import { describe, expect, it } from "bun:test";
import { computeContentHash } from "./content-hash";

describe("content-hash", () => {
  it("produces stable hashes regardless of key order", () => {
    const a = computeContentHash({ name: "Alpha", id: "1" });
    const b = computeContentHash({ id: "1", name: "Alpha" });
    expect(a).toBe(b);
  });
});
