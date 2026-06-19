import { describe, expect, it } from "bun:test";
import {
  resolveOccupationCodes,
  resolveOccupationName,
} from "./occupation-resolver";

describe("occupation-resolver", () => {
  it("resolves known CBO codes to occupation titles", () => {
    expect(resolveOccupationName("225125")).toBe("Médico clínico");
    expect(resolveOccupationName("225142")).toBe(
      "Médico da estratégia de saúde da família",
    );
  });

  it("returns null for empty codes", () => {
    expect(resolveOccupationName(null)).toBeNull();
    expect(resolveOccupationName("   ")).toBeNull();
  });

  it("falls back to the raw code when no label exists", () => {
    expect(resolveOccupationName("2231F9")).toBeNull();
  });

  it("resolves comma-separated occupation codes", () => {
    expect(resolveOccupationCodes("225125, 223505")).toBe(
      "Médico clínico, Enfermeiro",
    );
    expect(resolveOccupationCodes("2231F9")).toBe("2231F9");
  });
});
