import { describe, expect, it } from "bun:test";
import { parseListProfessionalsQuery } from "./list-professionals-query";

describe("parseListProfessionalsQuery", () => {
  it("requires both coordinates and rejects a radius without them", () => {
    expect(() => parseListProfessionalsQuery({ radiusKm: "10" })).toThrow();
    expect(parseListProfessionalsQuery({ latitude: "-23.55", longitude: "-46.63", specialty: "Cardiology" }))
      .toMatchObject({ latitude: -23.55, longitude: -46.63, specialty: "Cardiology" });
  });
});
