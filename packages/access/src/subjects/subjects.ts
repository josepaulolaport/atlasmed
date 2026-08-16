export const Subjects = {
  USER: "USER",

  FACILITY: "FACILITY",

  PERSON: "PERSON",

  TERRITORY: "TERRITORY",

  INVITATION: "INVITATION",

  CATALOG: "CATALOG",

  SEARCH_SYNC: "SEARCH_SYNC",

  VISIT: "VISIT",

  CALENDAR: "CALENDAR",

  INTERACTION: "INTERACTION",

  /** User-submitted Não Conformidades (not CNES registry suggestions). */
  FIELD_SUGGESTION: "FIELD_SUGGESTION",

  /** Ops Cadastro document review queue (approve / reject / list). */
  CADASTRO_SUBMISSION: "CADASTRO_SUBMISSION",

  /**
   * Roteiro do dia — the generated day plan (spec 0016).
   *
   * Separate from `CALENDAR` and `INTERACTION` on purpose. A manager may read
   * and draft a roteiro for their rep but must never write to that rep's
   * calendar, so the plan and the commitment need different verbs on different
   * subjects. Confirming a roteiro is gated on `INTERACTION`, which is already
   * owner-only.
   */
  ROTEIRO: "ROTEIRO",
} as const;

export type Subject = (typeof Subjects)[keyof typeof Subjects];
