/**
 * Brazilian street-type abbreviations, shared by the two paths that search a
 * facility address.
 *
 * The problem this solves: the registry stores the abbreviated form almost
 * without exception. In a 1443-clinic sample, 436 addresses begin `Av.` and
 * none begin `Avenida`; 676 begin `Rua`, 30 begin `Tv.`. A rep who types
 * "Avenida das Americas" is typing the expansion of a token the data only ever
 * holds contracted, so both search paths return nothing — Meilisearch because
 * typo tolerance allows one edit at that length and `Av.`→`Avenida` is five,
 * Postgres because its fallback is a single `ILIKE '%…%'` over the raw string.
 *
 * One table serves both because they fail differently and would drift: Meili
 * consumes it as index `synonyms` (applied only by a full rebuild), Postgres as
 * whole-string variants OR'd into the existing condition. A rep who searched
 * one way and got results, then searched the same words while the index lagged
 * and got none, would have no way to tell which answer was the real one.
 */

/**
 * Equivalent forms of one street-type token, canonical form first.
 *
 * Membership is deliberately narrow: only tokens observed as an address prefix
 * in the registry, and only expansions unambiguous in that position. `st` is
 * `setor` here and not `santo` — both occur in Brazilian addresses, but only
 * the first occurs as a leading token in this data, and a wrong pairing widens
 * every search that contains the word.
 */
export const ADDRESS_ABBREVIATION_GROUPS: readonly (readonly string[])[] = [
  ["avenida", "av"],
  ["rua", "r"],
  ["travessa", "tv", "trav"],
  ["alameda", "al"],
  ["rodovia", "rod"],
  ["estrada", "est"],
  ["praca", "pca", "pç", "praça"],
  ["quadra", "qd", "q"],
  ["setor", "st"],
  ["conjunto", "conj"],
  ["doutor", "dr"],
  ["doutora", "dra"],
  ["professor", "prof"],
  ["coronel", "cel"],
  ["marechal", "mal"],
  ["presidente", "pres"],
  ["governador", "gov"],
  ["santo", "sto"],
  ["santa", "sta"],
  // No bare "s": it abbreviates São, Santo and Santa alike, so it would pull
  // three unrelated groups together on a single typed letter.
  ["sao", "são"],
];

/**
 * Folds a token to the form used for lookup: lowercase, no trailing period, no
 * accents.
 *
 * The trailing period matters more than it looks. `Av.` and `Av` are the same
 * word to a reader and different strings to Postgres, and the registry writes
 * both. Accents are folded because 319 of those 1443 addresses carry one and
 * `ILIKE` does not fold them — Meili does, which is exactly the kind of
 * silent divergence between the two paths this module exists to prevent.
 */
export function normalizeAddressToken(token: string): string {
  return token
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\.+$/, "");
}

const GROUP_BY_TOKEN = new Map<string, readonly string[]>();
for (const group of ADDRESS_ABBREVIATION_GROUPS) {
  for (const form of group) {
    GROUP_BY_TOKEN.set(normalizeAddressToken(form), group);
  }
}

/**
 * Meilisearch `synonyms`, every form mapping to every other form in its group.
 *
 * Meili's own tokenizer already lowercases, folds accents, and drops the
 * trailing period, so the keys are the normalized forms and `Av.` in a document
 * reaches this table as `av`.
 */
export function buildAddressSearchSynonyms(): Record<string, string[]> {
  const synonyms: Record<string, string[]> = {};
  for (const group of ADDRESS_ABBREVIATION_GROUPS) {
    const forms = [...new Set(group.map(normalizeAddressToken))];
    for (const form of forms) {
      synonyms[form] = forms.filter((other) => other !== form);
    }
  }
  return synonyms;
}

/**
 * Caps the variant list.
 *
 * "Rua Doutor Santo Antonio" contains three expandable tokens, and the full
 * cartesian product of a query like that grows past anything worth sending to
 * Postgres as OR'd `ILIKE`s. Eight covers a query with three abbreviations and
 * bounds the cost of a pathological one.
 */
export const MAX_ADDRESS_QUERY_VARIANTS = 8;

/**
 * An abbreviation as the registry writes it: with the period and without.
 *
 * The table stores bare tokens because that is the form Meili's tokenizer
 * produces, but Postgres compares raw strings — and the data holds `Av. das
 * Americas`, so a variant of `av das Americas` matches nothing at all. Only
 * contractions get the dotted form; spelling out `avenida.` would be wrong.
 */
function withWrittenPeriod(form: string, canonical: string): string[] {
  const isContraction = form !== canonical && form.length < canonical.length;
  return isContraction ? [`${form}.`, form] : [form];
}

/**
 * Whole-string variants of a search term, for the Postgres fallback.
 *
 * The input is always first in the result, and a term with no recognised token
 * returns just itself — so a caller can OR over this list unconditionally and
 * a query that works today keeps working, matching exactly what it matched
 * before plus the abbreviation rewrites.
 *
 * This substitutes tokens; it does not split the query into independently
 * AND-ed words. "Ortomed Ipanema" still finds nothing through Postgres because
 * the name and the neighbourhood live in different columns and no single one
 * contains both words. Meili handles that case; the fallback does not.
 */
export function expandAddressAbbreviations(search: string): string[] {
  const trimmed = search.trim();
  if (!trimmed) return [];

  // Split on whitespace but keep it, so a variant can be rebuilt with the
  // original spacing rather than collapsed to single spaces.
  const parts = trimmed.split(/(\s+)/);
  let variants: string[][] = [[]];

  for (const part of parts) {
    const group = /\s/.test(part)
      ? undefined
      : GROUP_BY_TOKEN.get(normalizeAddressToken(part));

    if (!group || variants.length >= MAX_ADDRESS_QUERY_VARIANTS) {
      for (const variant of variants) variant.push(part);
      continue;
    }

    // The typed form leads its own group so the original string stays first.
    //
    // Dropped by lowercase equality, not by [normalizeAddressToken]: "Praca"
    // and "praça" normalize alike, and that is precisely the pair worth
    // emitting, because ILIKE does not fold the cedilla the way Meili does.
    const typed = part.toLowerCase();
    const forms = [
      part,
      ...group.flatMap((form) =>
        form.toLowerCase() === typed ? [] : withWrittenPeriod(form, group[0]!),
      ),
    ];
    const next: string[][] = [];
    for (const variant of variants) {
      for (const form of forms) {
        if (next.length >= MAX_ADDRESS_QUERY_VARIANTS) break;
        next.push([...variant, form]);
      }
    }
    variants = next;
  }

  return [...new Set(variants.map((variant) => variant.join("")))];
}
