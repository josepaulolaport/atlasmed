export const DeviceType = {
  DESKTOP: "DESKTOP",
  MOBILE: "MOBILE",
  TABLET: "TABLET",
  UNKNOWN: "UNKNOWN",
} as const;

export type DeviceType = (typeof DeviceType)[keyof typeof DeviceType];
