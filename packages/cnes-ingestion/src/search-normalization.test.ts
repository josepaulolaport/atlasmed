import { describe, expect, it } from "bun:test";
import { normalizeSearchFilterValue } from "./search-normalization";

describe("normalizeSearchFilterValue", () => {
  it("deterministically removes accents, folds case, and collapses whitespace", () => {
    expect(normalizeSearchFilterValue("  Cirurgia  VÁSCULAR ")).toBe("cirurgia vascular");
  });
});
