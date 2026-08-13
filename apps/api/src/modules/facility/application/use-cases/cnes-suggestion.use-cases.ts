import {
  DrizzleCnesSuggestionRepository,
  type CnesSuggestion,
} from "../../infrastructure/repositories/drizzle/drizzle-cnes-suggestion.repository";

/**
 * "Which professionals does CNES associate with this clinic that we already
 * know about, and have not linked yet?" (spec 0012 §5, AC 1–3.)
 */

/** Enough to fill a section without turning it into a second search surface. */
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export interface CnesSuggestionItem {
  /**
   * Null when we do not hold this person under any identity — CNES places them
   * at the clinic and nothing on our side matches. The rep imports them rather
   * than associating them, which is why the field is nullable rather than the
   * row being dropped: ~18 000 of the people CNES reports at our clinics are in
   * this state, and omitting them made the tab claim CNES knew nobody else.
   */
  personId: number | null;
  /** `CO_PROFISSIONAL_SUS` — what an import names, since there is no personId. */
  professionalCnesId: string;
  displayName: string;
  /** "MEDICO ORTOPEDISTA E TRAUMATOLOGISTA" — what makes the row useful. */
  occupation: string | null;
  occupations: string[];
  /** "CRM 119508/SP", or null when the registration is incomplete. */
  registrationLabel: string | null;
  /**
   * Already linked at this clinic as a clinician.
   *
   * Returned rather than filtered so the CNES view can show "of the people CNES
   * places here, these you already have" — coverage against this snapshot,
   * which our own roster cannot express. AC 2 is unaffected: these are labelled
   * and never appear as suggestions.
   */
  alreadyLinked: boolean;
}

export interface CnesSuggestionsResponse {
  items: CnesSuggestionItem[];
  /**
   * Why the list is empty, when it is. The client shows a different empty state
   * for each, because "this clinic has no CNES code" and "CNES knows nobody new
   * here" are not the same message to a rep.
   */
  status: "OK" | "FACILITY_WITHOUT_CNES_CODE" | "FACILITY_NOT_IN_REGISTRY" | "REGISTRY_EMPTY";
  /** Competence of the loaded snapshot, e.g. `2026-05`. */
  reference: string | null;
  loadedAt: string | null;
  limit: number;
  /** The list was cut at `limit`; there are more. */
  hasMore: boolean;
}

/**
 * Our name for them when we have one, CNES's otherwise.
 *
 * Ours wins because it is the name a rep typed and will recognise; the registry
 * ships uppercase legal names that disagree with ours on ~0.5 % of confirmed
 * matches — dropped middle names, married names, the occasional typo.
 */
function displayNameOf(row: CnesSuggestion): string {
  const social = row.socialName?.trim();
  if (social) return social;
  const ours = `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim();
  if (ours) return ours;
  const registrySocial = row.registrySocialName?.trim();
  if (registrySocial) return registrySocial;
  return row.registryFullName.trim();
}

function registrationLabelOf(row: CnesSuggestion): string | null {
  if (!row.registrationNumber || !row.registrationStateCode) return null;
  const council = row.registrationCouncil ?? "Registro";
  return `${council} ${row.registrationNumber}/${row.registrationStateCode}`;
}

export class ListCnesSuggestionsUseCase {
  constructor(
    private readonly repository = new DrizzleCnesSuggestionRepository()
  ) {}

  async execute(input: {
    facilityId: number;
    limit?: number;
  }): Promise<CnesSuggestionsResponse> {
    const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const context = await this.repository.context(input.facilityId);

    const empty = (status: CnesSuggestionsResponse["status"]) => ({
      items: [],
      status,
      reference: context.loadedReference,
      loadedAt: context.loadedAt?.toISOString() ?? null,
      limit,
      hasMore: false,
    });

    // Ordered most-specific first: a clinic with no code cannot be in the
    // registry, and saying "registry empty" there would send someone looking in
    // the wrong place.
    if (!context.facilityHasCnesCode) return empty("FACILITY_WITHOUT_CNES_CODE");
    // Keyed on the registry's contents, not on the run ledger. A load performed
    // by script, or one whose ledger row was pruned, is still a load — reporting
    // it as empty told users nothing had been imported while the tables were
    // full. The competence is a label; its absence is not evidence of absence.
    if (!context.registryHasData) return empty("REGISTRY_EMPTY");
    if (!context.facilityInRegistry) return empty("FACILITY_NOT_IN_REGISTRY");

    // One more than asked, so "there are more" is known rather than guessed.
    const rows = await this.repository.list({
      facilityId: input.facilityId,
      limit: limit + 1,
    });
    const hasMore = rows.length > limit;

    return {
      items: rows.slice(0, limit).map((row) => ({
        personId: row.personId,
        professionalCnesId: row.professionalCnesId,
        displayName: displayNameOf(row),
        occupation: row.occupations[0] ?? null,
        occupations: row.occupations,
        registrationLabel: registrationLabelOf(row),
        alreadyLinked: row.alreadyLinked,
      })),
      status: "OK",
      reference: context.loadedReference,
      loadedAt: context.loadedAt?.toISOString() ?? null,
      limit,
      hasMore,
    };
  }
}
