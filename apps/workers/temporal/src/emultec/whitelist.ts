/**
 * Emultec product ids for EVISC / REVISCON / TRUVISC import (Slice 1).
 * Excludes junk/demo ids 827, 828, 2412.
 */
export const EMULTEC_PRODUCT_WHITELIST_IDS = [
  1, 2, 3, 4, 5, 6, 2426, 2427, 2428, 2429, 2430, 2431,
] as const;

export type EmultecProductWhitelistId =
  (typeof EMULTEC_PRODUCT_WHITELIST_IDS)[number];

export const EMULTEC_PRODUCT_NAME_REGEXP = "EVISC|REVISCON|TRUVISC";
