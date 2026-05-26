export const Subjects = {
  USER: "USER",

  CLINIC: "CLINIC",

  VISIT: "VISIT",

  TERRITORY: "TERRITORY",

  INVITATION: "INVITATION",
} as const;

export type Subject = (typeof Subjects)[keyof typeof Subjects];
