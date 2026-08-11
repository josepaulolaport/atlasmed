/**
 * Validity dates on cadastro documents (spec 0011 §3.3, ADR 0008 §4 and §6).
 *
 * The rep enters the date at submit, only where the requirement declares one;
 * the reviewer confirms or corrects it while approving. Both people are looking
 * at the same document — the rep is holding it, the reviewer is already opening
 * the file — so both get a say, and the reviewer's wins.
 *
 * **The warning is derived here, never stored.** `conformity_status` gained an
 * `EXPIRING_SOON` value once and migration `0081` removed it: a status that has
 * to be rewritten daily is a second source of truth for a fact the date already
 * carries, and the job that rewrites it is one more thing that can stop
 * silently. The date is the truth; this is a function of it and today.
 */

/**
 * How far ahead a document starts warning.
 *
 * A display threshold, not a stored state — changing it changes what reps see
 * on their next request and nothing else. Thirty days is the usual renewal
 * window for a sanitary licence, the only requirement that declares a validity
 * today.
 */
export const EXPIRY_WARNING_DAYS = 30;

export type CadastroExpiryStatus = "VALID" | "EXPIRING_SOON" | "EXPIRED";

export interface CadastroExpiry {
  validUntil: string;
  daysRemaining: number;
  status: CadastroExpiryStatus;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** `YYYY-MM-DD`, the shape Postgres `date` round-trips. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  // Rejects 2026-02-30, which `Date` would happily roll forward to March.
  return parsed.toISOString().slice(0, 10) === value;
}

/**
 * Days from `today` until `validUntil`, counted in whole calendar days.
 *
 * Both sides are pinned to UTC midnight deliberately. A validity is a calendar
 * fact — an alvará expires on a day, not at an instant — so comparing a date to
 * a timestamp would make the answer depend on the server's clock time and shift
 * "expires today" by one either side of midnight.
 */
export function daysUntil(validUntil: string, today: Date): number {
  const end = Date.parse(`${validUntil}T00:00:00.000Z`);
  const start = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  );
  return Math.round((end - start) / MS_PER_DAY);
}

/**
 * The expiry state of a document, or null when it has no validity at all.
 *
 * Null is not "fine" — it means the question does not apply, which is the
 * common case: only requirements declaring `requiresValidityDate` carry one.
 */
export function deriveExpiry(
  validUntil: string | null | undefined,
  today: Date
): CadastroExpiry | null {
  if (!validUntil) return null;

  const daysRemaining = daysUntil(validUntil, today);
  const status: CadastroExpiryStatus =
    daysRemaining < 0
      ? "EXPIRED"
      : daysRemaining <= EXPIRY_WARNING_DAYS
        ? "EXPIRING_SOON"
        : "VALID";

  return { validUntil, daysRemaining, status };
}
