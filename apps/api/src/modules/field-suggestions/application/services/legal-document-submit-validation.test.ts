import { describe, expect, it } from "bun:test";
import fixture from "../../../../../../../packages/database/fixtures/cpf-checksum-cases.json";
import { ValidationError } from "../../../../shared/errors";
import { FieldSuggestionApplyService } from "./field-suggestion-apply.service";

/**
 * A suggested CPF is checked when it is filed, not only when it is approved.
 *
 * `applyFieldChange` always ran the módulo-11 check; `validateProposedValue`
 * did not, accepting any non-empty string. The consequence was not a rejected
 * suggestion — it was an accepted one: `123` entered the review queue, looked
 * like real work, and failed on the reviewer at approval, who is the one person
 * unable to correct it.
 *
 * Verified to fail by restoring `asNonEmptyString` for `legalDocument`.
 */
const service = new FieldSuggestionApplyService({} as never);

const validate = (value: unknown) =>
  service.validateProposedValue("legalDocument", value);

describe("validateProposedValue for legalDocument", () => {
  it("refuses a value that is not a document at all", () => {
    expect(() => validate("123")).toThrow(ValidationError);
  });

  it("refuses a CPF whose check digits do not add up", () => {
    expect(() => validate("529.982.247-24")).toThrow(ValidationError);
  });

  it("refuses the all-same-digit CPFs that get typed past required fields", () => {
    expect(() => validate("111.111.111-11")).toThrow(ValidationError);
    expect(() => validate("000.000.000-00")).toThrow(ValidationError);
  });

  it("accepts a valid CPF, punctuated or not", () => {
    expect(validate("529.982.247-25")).toBe("529.982.247-25");
    expect(validate("52998224725")).toBe("52998224725");
  });

  it("accepts a valid CNPJ, since the same field carries both", () => {
    // The type is inferred from length here; a CNPJ proposed for a CPF clinic
    // is caught on apply, where the facility's own type is known.
    expect(validate("12.345.678/0001-95")).toBe("12.345.678/0001-95");
  });

  it("keeps the rep's formatting rather than normalizing on the way in", () => {
    // The reviewer reads what was typed; applyFieldChange strips punctuation
    // before writing. Normalizing here would change the review queue's display
    // for no benefit.
    expect(validate("  529.982.247-25  ")).toBe("529.982.247-25");
  });

  it("still refuses an empty value", () => {
    expect(() => validate("")).toThrow(ValidationError);
    expect(() => validate("   ")).toThrow(ValidationError);
  });

  it("agrees with the shared fixture on every CPF-shaped case", () => {
    // Same cases as the SQL function and the Dart validator. A CNPJ-shaped
    // entry is skipped: this field legitimately accepts both, so only the
    // CPF-shaped ones say anything about the CPF rule.
    for (const entry of fixture.cases) {
      if (entry.digits.length === 14) continue;
      const attempt = () => validate(entry.raw);
      if (entry.valid) {
        expect(attempt).not.toThrow();
      } else {
        expect(attempt).toThrow(ValidationError);
      }
    }
  });
});
