export const Subjects = {
  USER: "USER",

  FACILITY: "FACILITY",

  PROFESSIONAL: "PROFESSIONAL",

  TERRITORY: "TERRITORY",

  INVITATION: "INVITATION",

  REGISTRY_INGESTION: "REGISTRY_INGESTION",

  REGISTRY_SUGGESTION: "REGISTRY_SUGGESTION",

  CATALOG: "CATALOG",

  SEARCH_SYNC: "SEARCH_SYNC",

  VISIT: "VISIT",

  /** User-submitted Não Conformidades (not CNES registry suggestions). */
  FIELD_SUGGESTION: "FIELD_SUGGESTION",
} as const;

export type Subject = (typeof Subjects)[keyof typeof Subjects];
