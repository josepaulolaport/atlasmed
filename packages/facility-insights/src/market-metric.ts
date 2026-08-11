/**
 * Market-potential arithmetic (spec 0013 §4.3).
 *
 * Pure by construction: no clock, no database, no timezone read from the
 * environment. The caller supplies the instant and the zone, which is what makes
 * `facility_metric_snapshots` a cache that can be rebuilt from scratch and
 * reproduce itself exactly.
 */

/**
 * Months are calendar months **in São Paulo**, not UTC.
 *
 * `orders.ordered_at` is `timestamp without time zone` on a UTC server, so UTC
 * bounds would file an order taken 31 March at 22:00 in São Paulo under April —
 * and the rep who entered it would disagree with the chart. The rep answers
 * *quantas por mês* and means their own months.
 */
export const APPLICATION_TIMEZONE = "America/Sao_Paulo";

/** First day of a calendar month, `YYYY-MM-01`. */
export type MonthKey = string;

export type MarketMetricValidationErrorCode = "INVALID_MONTH" | "INVALID_WINDOW";

export class MarketMetricValidationError extends Error {
  constructor(
    readonly code: MarketMetricValidationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "MarketMetricValidationError";
  }
}

const MONTH_KEY_PATTERN = /^(\d{4})-(\d{2})-01$/;

function parseMonthKey(month: MonthKey): { year: number; month: number } {
  const match = MONTH_KEY_PATTERN.exec(month);
  if (!match) {
    throw new MarketMetricValidationError(
      "INVALID_MONTH",
      `Expected a month key of the form YYYY-MM-01, received "${month}"`,
    );
  }
  const year = Number(match[1]);
  const monthOfYear = Number(match[2]);
  if (monthOfYear < 1 || monthOfYear > 12) {
    throw new MarketMetricValidationError(
      "INVALID_MONTH",
      `Month must be between 01 and 12, received "${month}"`,
    );
  }
  return { year, month: monthOfYear };
}

function formatMonthKey(year: number, month: number): MonthKey {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`;
}

function partsAt(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}

function offsetMillisecondsAt(instant: Date, timeZone: string): number {
  const local = partsAt(instant, timeZone);
  const localAsUtc = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second,
  );
  return localAsUtc - instant.getTime();
}

/**
 * The UTC instant of local midnight on the first of `month`.
 *
 * The offset is resolved twice on purpose: the first pass guesses using the
 * offset in force at the naive instant, the second corrects it using the offset
 * actually in force at the resulting instant. One pass is wrong across a DST
 * boundary. Brazil dropped DST in 2019, so this is currently belt-and-braces —
 * but the same helper is what a future zone change would run through, and a
 * silently shifted month boundary is not the kind of bug that announces itself.
 */
function localMonthStartToUtc(year: number, month: number, timeZone: string): Date {
  const naive = Date.UTC(year, month - 1, 1);
  const firstPass = new Date(naive - offsetMillisecondsAt(new Date(naive), timeZone));
  return new Date(naive - offsetMillisecondsAt(firstPass, timeZone));
}

/** Which month an instant falls in, in the supplied zone. */
export function monthKeyAt(instant: Date, timeZone: string = APPLICATION_TIMEZONE): MonthKey {
  const local = partsAt(instant, timeZone);
  return formatMonthKey(local.year, local.month);
}

/**
 * The half-open interval `[month, next month)` as UTC instants, ready to compare
 * against `orders.ordered_at`.
 *
 * Half-open matters: a closed interval double-counts an order placed exactly at
 * midnight on the first, and the live query it replaces had no upper bound at
 * all, so future-dated orders leaked into the current window.
 */
export function monthBounds(
  month: MonthKey,
  timeZone: string = APPLICATION_TIMEZONE,
): { start: Date; end: Date } {
  const { year, month: monthOfYear } = parseMonthKey(month);
  const next = addMonths(month, 1);
  const { year: nextYear, month: nextMonth } = parseMonthKey(next);
  return {
    start: localMonthStartToUtc(year, monthOfYear, timeZone),
    end: localMonthStartToUtc(nextYear, nextMonth, timeZone),
  };
}

/** Shift a month key by whole months, in either direction. */
export function addMonths(month: MonthKey, delta: number): MonthKey {
  const { year, month: monthOfYear } = parseMonthKey(month);
  const zeroBased = year * 12 + (monthOfYear - 1) + delta;
  return formatMonthKey(Math.floor(zeroBased / 12), (zeroBased % 12) + 1);
}

/**
 * The `count` months ending at `month`, oldest first — the window the read path
 * averages over.
 */
export function trailingMonths(month: MonthKey, count: number): MonthKey[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new MarketMetricValidationError(
      "INVALID_WINDOW",
      `Window must be a positive whole number of months, received ${count}`,
    );
  }
  const months: MonthKey[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    months.push(addMonths(month, -offset));
  }
  return months;
}

/**
 * Total and share for one month.
 *
 * Mirrors the generated columns on `facility_metric_snapshots` so the read path
 * can derive the same figures for a trailing window without a second definition
 * of the rule drifting from the first.
 *
 * `share` is **null, never 0**, when nothing is known (spec 0013 §4.3): "we sell
 * nothing here" and "we have no information" must stay distinguishable, and a 0
 * reads as the former while meaning the latter.
 */
export function deriveShare(
  oursQty: number,
  theirsQty: number,
): { totalQty: number; share: number | null } {
  const totalQty = oursQty + theirsQty;
  return { totalQty, share: totalQty > 0 ? oursQty / totalQty : null };
}

/**
 * The trailing monthly mean over a fixed window.
 *
 * Divides by the window, not by the number of months supplied — a clinic that
 * ordered in one of the last three months averages over three, because the two
 * silent months are real zeros rather than missing data.
 */
export function averageMonthly(
  monthlyQuantities: readonly number[],
  monthsInWindow: number,
): number {
  if (!Number.isInteger(monthsInWindow) || monthsInWindow < 1) {
    throw new MarketMetricValidationError(
      "INVALID_WINDOW",
      `Window must be a positive whole number of months, received ${monthsInWindow}`,
    );
  }
  const sum = monthlyQuantities.reduce((total, value) => total + value, 0);
  return sum / monthsInWindow;
}
