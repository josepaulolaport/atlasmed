import { describe, expect, it } from "bun:test";
import { parseSpecialtyFilterValues } from "./specialty-filter";

describe("parseSpecialtyFilterValues", () => {
  it("splits comma-joined labels and normalizes", () => {
    expect(parseSpecialtyFilterValues("Cardiologia, Pediatria")).toEqual([
      "cardiologia",
      "pediatria",
    ]);
  });

  it("dedupes and drops blanks", () => {
    expect(parseSpecialtyFilterValues("  Ortopedia , , Ortopedia ")).toEqual([
      "ortopedia",
    ]);
  });
});
