import { describe, expect, it } from "bun:test";
import fixture from "../../../../../../../packages/database/fixtures/cpf-checksum-cases.json";
import {
  isValidCpfDigits,
  normalizeLegalDocument,
} from "./facility-tax-id.utils";

/**
 * The API's half of the shared CPF fixture.
 *
 * The same rule is implemented three times — here, as `is_valid_cpf` in
 * Postgres (only the database can say which rows have a bad CPF, for the count
 * and the filtered list), and in Dart so a rep is told as they type instead of
 * after a round trip. None of the three can be removed, so the guard against
 * them drifting is that all three answer the same cases.
 *
 * `facility-tax-id.utils.test.ts` still covers this function's own edges; this
 * file exists to keep it in step with the other two.
 */
const { cases } = fixture;

describe("isValidCpfDigits against the shared fixture", () => {
  it("has cases on both sides of the verdict", () => {
    // A fixture that drifted to all-invalid would pass against a function that
    // simply returned false, and nobody would notice.
    expect(cases.some((entry) => entry.valid)).toBe(true);
    expect(cases.some((entry) => !entry.valid)).toBe(true);
  });

  for (const entry of cases) {
    it(`${entry.valid ? "accepts" : "rejects"} ${JSON.stringify(entry.raw)} — ${entry.why}`, () => {
      expect(isValidCpfDigits(entry.digits)).toBe(entry.valid);
    });
  }

  it("derives the fixture's digits from its raw value the way the app does", () => {
    // The SQL function is handed the raw string and strips punctuation itself,
    // while this validator receives already-stripped digits. If those two ever
    // disagree about what stripping means, the fixture stops comparing like
    // with like and the three implementations could diverge unnoticed.
    for (const entry of cases) {
      expect(normalizeLegalDocument(entry.raw) ?? "").toBe(entry.digits);
    }
  });
});
