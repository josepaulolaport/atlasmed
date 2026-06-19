export const Subjects = {
  USER: "USER",

  CLINIC: "CLINIC",

  DOCTOR: "DOCTOR",

  VISIT: "VISIT",

  TERRITORY: "TERRITORY",

  INVITATION: "INVITATION",

  REGISTRY_INGESTION: "REGISTRY_INGESTION",

  REGISTRY_SUGGESTION: "REGISTRY_SUGGESTION",
} as const;

export type Subject = (typeof Subjects)[keyof typeof Subjects];
