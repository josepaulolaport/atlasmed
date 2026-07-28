import { describe, expect, it } from "bun:test";
import { facilityServicePriorityRank } from "./facility-service-display.utils";

describe("facilityServicePriorityRank", () => {
  it("ranks AtlasMed Ortopedia / Dermatologia codes first", () => {
    expect(
      facilityServicePriorityRank({
        serviceCode: "AM-ORTOPEDIA",
        serviceName: "Ortopedia",
      }),
    ).toBe(0);
    expect(
      facilityServicePriorityRank({
        serviceCode: "AM-DERMATOLOGIA",
        serviceName: "Dermatologia",
      }),
    ).toBe(1);
  });

  it("keeps CNES traumatologia/ortopedia as priority 0", () => {
    expect(
      facilityServicePriorityRank({
        serviceCode: "155",
        serviceName: "SERVICO DE TRAUMATOLOGIA E ORTOPEDIA",
      }),
    ).toBe(0);
  });
});
