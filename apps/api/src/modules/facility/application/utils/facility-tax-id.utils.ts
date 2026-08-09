export type FacilityLegalDocumentType = "CNPJ" | "CPF";

/** Strip punctuation; empty → null. */
export function normalizeLegalDocument(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const digits = raw.replace(/\D/g, "");
  return digits.length === 0 ? null : digits;
}

/** Prefer stored type; otherwise infer from digit length (14=CNPJ, 11=CPF). */
export function resolveFacilityLegalDocumentType(facility: {
  legalDocumentType: FacilityLegalDocumentType | null;
  legalDocument: string | null;
}): FacilityLegalDocumentType | null {
  if (facility.legalDocumentType === "CNPJ" || facility.legalDocumentType === "CPF") {
    return facility.legalDocumentType;
  }
  const digits = facility.legalDocument?.replace(/\D/g, "") ?? "";
  if (digits.length === 14) return "CNPJ";
  if (digits.length === 11) return "CPF";
  return null;
}

function allSameDigit(digits: string): boolean {
  return /^(\d)\1+$/.test(digits);
}

function mod11CheckDigit(digits: string, weights: number[]): number {
  let sum = 0;
  for (let i = 0; i < weights.length; i++) {
    sum += Number(digits[i]) * weights[i]!;
  }
  const mod = sum % 11;
  return mod < 2 ? 0 : 11 - mod;
}

export function isValidCpfDigits(digits: string): boolean {
  if (digits.length !== 11 || allSameDigit(digits)) return false;
  const d1 = mod11CheckDigit(digits, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (d1 !== Number(digits[9])) return false;
  const d2 = mod11CheckDigit(digits, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d2 === Number(digits[10]);
}

export function isValidCnpjDigits(digits: string): boolean {
  if (digits.length !== 14 || allSameDigit(digits)) return false;
  const d1 = mod11CheckDigit(digits, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (d1 !== Number(digits[12])) return false;
  const d2 = mod11CheckDigit(digits, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d2 === Number(digits[13]);
}

export type LegalDocumentValidationIssue = {
  field: string;
  message: string;
};

/**
 * Normalize + validate legal document against type (length + módulo-11).
 * Type may be inferred from length when omitted.
 */
export function validateLegalDocument(input: {
  legalDocumentType?: FacilityLegalDocumentType | null;
  legalDocument?: string | null;
  typeField?: string;
  documentField?: string;
}): {
  ok: true;
  legalDocumentType: FacilityLegalDocumentType;
  legalDocument: string;
} | {
  ok: false;
  issues: LegalDocumentValidationIssue[];
} {
  const typeField = input.typeField ?? "legalDocumentType";
  const documentField = input.documentField ?? "legalDocument";
  const digits = normalizeLegalDocument(input.legalDocument);
  if (!digits) {
    return {
      ok: false,
      issues: [{ field: documentField, message: "legalDocument is required" }],
    };
  }

  let type = input.legalDocumentType ?? null;
  if (!type) {
    if (digits.length === 14) type = "CNPJ";
    else if (digits.length === 11) type = "CPF";
  }

  if (type !== "CNPJ" && type !== "CPF") {
    return {
      ok: false,
      issues: [{ field: typeField, message: "legalDocumentType must be CNPJ or CPF" }],
    };
  }

  if (type === "CNPJ") {
    if (digits.length !== 14) {
      return {
        ok: false,
        issues: [{ field: documentField, message: "CNPJ must have 14 digits" }],
      };
    }
    if (!isValidCnpjDigits(digits)) {
      return {
        ok: false,
        issues: [{ field: documentField, message: "CNPJ check digits are invalid" }],
      };
    }
  } else {
    if (digits.length !== 11) {
      return {
        ok: false,
        issues: [{ field: documentField, message: "CPF must have 11 digits" }],
      };
    }
    if (!isValidCpfDigits(digits)) {
      return {
        ok: false,
        issues: [{ field: documentField, message: "CPF check digits are invalid" }],
      };
    }
  }

  return { ok: true, legalDocumentType: type, legalDocument: digits };
}
