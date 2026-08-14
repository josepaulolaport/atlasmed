import { describe, expect, it } from "bun:test";
import {
  ADDRESS_ABBREVIATION_GROUPS,
  MAX_ADDRESS_QUERY_VARIANTS,
  buildAddressSearchSynonyms,
  expandAddressAbbreviations,
  normalizeAddressToken,
} from "./address-abbreviations";

describe("normalizeAddressToken", () => {
  it("folds the trailing period the registry writes inconsistently", () => {
    // "Av." and "Av" are one word to a reader and two strings to Postgres.
    expect(normalizeAddressToken("Av.")).toBe("av");
    expect(normalizeAddressToken("Av")).toBe("av");
  });

  it("folds accents, which ILIKE does not", () => {
    expect(normalizeAddressToken("Praça")).toBe("praca");
  });
});

describe("expandAddressAbbreviations", () => {
  it("finds the abbreviated form the data actually holds", () => {
    // The reported bug: 436 addresses begin "Av.", none begin "Avenida", so
    // the typed expansion matched nothing.
    expect(expandAddressAbbreviations("Avenida das Americas")).toContain(
      "av das Americas",
    );
  });

  it("writes the contraction with its period, as the registry does", () => {
    // Without this the variant is "av das Americas", which does not match the
    // stored "Av. das Americas" — the fix would look applied and change nothing.
    expect(expandAddressAbbreviations("Avenida das Americas")).toContain(
      "av. das Americas",
    );
  });

  it("does not put a period on a spelled-out form", () => {
    expect(expandAddressAbbreviations("Av. das Americas")).not.toContain(
      "avenida. das Americas",
    );
  });

  it("expands in the other direction too", () => {
    // 676 addresses begin "Rua" — a rep typing the contraction must find them.
    expect(expandAddressAbbreviations("R. Visconde")).toContain("rua Visconde");
  });

  it("returns the typed term first", () => {
    // Callers OR over this list; leading with the input keeps the existing
    // match a strict subset of the new one.
    expect(expandAddressAbbreviations("Avenida Brasil")[0]).toBe(
      "Avenida Brasil",
    );
  });

  it("returns a term with no street type unchanged", () => {
    expect(expandAddressAbbreviations("Ortomed Saude")).toEqual([
      "Ortomed Saude",
    ]);
  });

  it("preserves the spacing it was given", () => {
    // Rebuilt from parts, so a double space must not silently become one and
    // turn an ILIKE that matched into one that does not.
    expect(expandAddressAbbreviations("Avenida  Brasil")).toContain(
      "Avenida  Brasil",
    );
  });

  it("bridges the accent gap on praça", () => {
    // Six addresses store "Praça"; nobody types the cedilla on a phone.
    expect(expandAddressAbbreviations("Praca Maua")).toContain("praça Maua");
  });

  it("caps a query stuffed with street types", () => {
    const variants = expandAddressAbbreviations(
      "Rua Doutor Santo Coronel Presidente Governador",
    );
    expect(variants.length).toBeLessThanOrEqual(MAX_ADDRESS_QUERY_VARIANTS);
    // Capping must not drop the typed term — that would lose results.
    expect(variants).toContain("Rua Doutor Santo Coronel Presidente Governador");
  });

  it("has nothing to expand in an empty term", () => {
    expect(expandAddressAbbreviations("   ")).toEqual([]);
  });
});

describe("buildAddressSearchSynonyms", () => {
  it("is bidirectional", () => {
    const synonyms = buildAddressSearchSynonyms();
    expect(synonyms.av).toContain("avenida");
    expect(synonyms.avenida).toContain("av");
  });

  it("keys on the form Meili's tokenizer produces", () => {
    // Meili lowercases, folds accents and drops the period before consulting
    // synonyms, so a key of "Av." or "praça" would never be looked up.
    for (const key of Object.keys(buildAddressSearchSynonyms())) {
      expect(key).toBe(normalizeAddressToken(key));
    }
  });

  it("never maps a form to itself", () => {
    const synonyms = buildAddressSearchSynonyms();
    for (const [form, others] of Object.entries(synonyms)) {
      expect(others).not.toContain(form);
    }
  });

  it("omits the bare s that would merge são, santo and santa", () => {
    expect(buildAddressSearchSynonyms().s).toBeUndefined();
  });

  it("keeps every group unambiguous — no token in two groups", () => {
    // A token in two groups makes expansion order-dependent and silently
    // widens every search containing that word.
    const seen = new Map<string, number>();
    ADDRESS_ABBREVIATION_GROUPS.forEach((group, index) => {
      for (const form of group) {
        const token = normalizeAddressToken(form);
        expect(seen.get(token) ?? index).toBe(index);
        seen.set(token, index);
      }
    });
  });
});
