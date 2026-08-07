import { describe, expect, test } from "bun:test";
import {
  isValidCnpjDigits,
  isValidCpfDigits,
  normalizeLegalDocument,
  validateLegalDocument,
} from "./facility-tax-id.utils";

describe("facility legal document validation", () => {
  test("normalizeLegalDocument strips punctuation", () => {
    expect(normalizeLegalDocument("12.345.678/0001-95")).toBe("12345678000195");
    expect(normalizeLegalDocument("   ")).toBeNull();
  });

  test("accepts valid CNPJ with check digits", () => {
    // Known-valid sample: 04.252.011/0001-10
    const result = validateLegalDocument({
      legalDocumentType: "CNPJ",
      legalDocument: "04.252.011/0001-10",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.legalDocument).toBe("04252011000110");
      expect(result.legalDocumentType).toBe("CNPJ");
    }
  });

  test("rejects CNPJ with bad check digits", () => {
    const result = validateLegalDocument({
      legalDocumentType: "CNPJ",
      legalDocument: "04252011000111",
    });
    expect(result.ok).toBe(false);
  });

  test("accepts valid CPF with check digits", () => {
    // Known-valid sample: 529.982.247-25
    const result = validateLegalDocument({
      legalDocumentType: "CPF",
      legalDocument: "529.982.247-25",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.legalDocument).toBe("52998224725");
    }
  });

  test("rejects wrong length for type", () => {
    const result = validateLegalDocument({
      legalDocumentType: "CNPJ",
      legalDocument: "52998224725",
    });
    expect(result.ok).toBe(false);
  });

  test("rejects all-same-digit documents", () => {
    expect(isValidCpfDigits("11111111111")).toBe(false);
    expect(isValidCnpjDigits("00000000000000")).toBe(false);
  });
});
