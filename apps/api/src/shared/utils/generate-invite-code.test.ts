import { describe, expect, it } from "bun:test";
import {
  generateInviteCode,
  normalizeInviteCode,
} from "./generate-invite-code";

describe("generateInviteCode", () => {
  it("returns an 8-character uppercase code by default", () => {
    const code = generateInviteCode();
    expect(code).toHaveLength(8);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]+$/);
  });
});

describe("normalizeInviteCode", () => {
  it("strips spaces/dashes and uppercases", () => {
    expect(normalizeInviteCode(" ab-cd ef ")).toBe("ABCDEF");
  });
});
