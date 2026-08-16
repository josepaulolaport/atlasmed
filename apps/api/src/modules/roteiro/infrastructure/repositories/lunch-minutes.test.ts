import { describe, expect, it } from "bun:test";
import { DrizzleRoteiroRepository } from "./drizzle-roteiro.repository";

const parse = DrizzleRoteiroRepository.parseLunchMinutes;

describe("parseLunchMinutes", () => {
  it("keeps an unset value unset, so the linha default can apply", () => {
    // The defect: `->>` returns SQL NULL for a missing key and `Number(null)`
    // is a perfectly finite zero inside the range, so every rep who had never
    // chosen reported a break of no minutes. `?? linhaParams.lunchMinutes`
    // never fired and the linha's 60 minutes reached nobody — the engine
    // reserved a zero-width block at midday and planned straight through it.
    expect(parse(null)).toBeNull();
    expect(parse(undefined)).toBeNull();
  });

  it("honours an explicit zero — working through lunch is an answer", () => {
    expect(parse(0)).toBe(0);
    expect(parse("0")).toBe(0);
  });

  it("reads the number the rep chose", () => {
    expect(parse("45")).toBe(45);
    expect(parse(90)).toBe(90);
  });

  it("treats anything malformed or out of range as unset", () => {
    // A bad string must not be able to make the engine plan a day that does
    // not exist.
    expect(parse("almoço")).toBeNull();
    expect(parse(-30)).toBeNull();
    expect(parse(600)).toBeNull();
  });
});
