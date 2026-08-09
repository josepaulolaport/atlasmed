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
} as const;

export type Subject = (typeof Subjects)[keyof typeof Subjects];
