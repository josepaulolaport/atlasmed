export const SessionType = {
  WEB: "WEB",
  MOBILE: "MOBILE",
  API: "API",
  UNKNOWN: "UNKNOWN",
} as const;

export type SessionType = (typeof SessionType)[keyof typeof SessionType];
