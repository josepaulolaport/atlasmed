export const Subjects = {
  USER: "USER",

  CLINIC: "CLINIC",

  VISIT: "VISIT",

  TERRITORY: "TERRITORY",
} as const;

export type Subject = (typeof Subjects)[keyof typeof Subjects];
