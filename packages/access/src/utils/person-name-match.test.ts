import { describe, expect, it } from "bun:test";
import {
  birthDatesMatch,
  namesFuzzyMatch,
  tokenizePersonName,
} from "./person-name-match";

describe("tokenizePersonName", () => {
  it("strips accents, case, and particles", () => {
    expect(tokenizePersonName("José Paulo de Laport")).toEqual([
      "jose",
      "paulo",
      "laport",
    ]);
  });
});

describe("namesFuzzyMatch", () => {
  it("passes when most tokens overlap", () => {
    expect(namesFuzzyMatch("Jose Paulo Laport", "Jose Laport")).toBe(true);
    expect(namesFuzzyMatch("Jose Paulo Laport", "Jose Paulo Silva Laport")).toBe(
      true,
    );
  });

  it("fails when too few tokens overlap", () => {
    expect(namesFuzzyMatch("Jose Paulo Laport", "Maria Silva")).toBe(false);
    expect(namesFuzzyMatch("Jose Paulo Laport", "Jose")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(namesFuzzyMatch("ANA BEATRIZ COSTA", "ana costa")).toBe(true);
  });
});

describe("birthDatesMatch", () => {
  it("compares calendar dates only", () => {
    expect(birthDatesMatch("1990-05-12", "1990-05-12")).toBe(true);
    expect(birthDatesMatch(new Date("1990-05-12T15:00:00.000Z"), "1990-05-12")).toBe(
      true,
    );
    expect(birthDatesMatch("1990-05-12", "1990-05-13")).toBe(false);
  });
});
