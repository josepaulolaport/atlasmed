import { describe, expect, it } from "bun:test";
import {
  formatLicenseEntries,
  formatLicenseLabel,
  resolveCouncilAcronym,
} from "./license-resolver";

describe("license-resolver", () => {
  it("formats CREFITO registrations with state and number", () => {
    expect(
      formatLicenseLabel({
        councilCode: "70",
        councilName: "fisioterapia e terapia ocup conselho regional",
        licenseState: "SP",
        licenseNumber: "188196F",
      }),
    ).toBe("CREFITO-SP 188196-F");
  });

  it("formats CRM registrations", () => {
    expect(
      formatLicenseLabel({
        councilCode: "71",
        licenseState: "RJ",
        licenseNumber: "123456",
      }),
    ).toBe("CRM-RJ 123456");
  });

  it("derives acronyms from council names when code is unknown", () => {
    expect(
      resolveCouncilAcronym("99", "medicina conselho regional"),
    ).toBe("CRM");
  });

  it("deduplicates formatted license entries", () => {
    expect(
      formatLicenseEntries([
        {
          councilCode: "70",
          licenseState: "SP",
          licenseNumber: "188196F",
        },
        {
          councilCode: "70",
          licenseState: "SP",
          licenseNumber: "188196F",
        },
      ]),
    ).toBe("CREFITO-SP 188196-F");
  });
});
