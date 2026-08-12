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
 * The observed market and our share of it — the whole rule, in one place.
 *
 * There are two expressions of this rule and there can only ever be two: this
 * one, and the generated `share` column on `facility_metric_snapshots`. The
 * column exists because cross-clinic aggregates average share in SQL; this
 * function exists because the clinic screen computes live, so that its headline
 * agrees with the per-product rows underneath it. Neither can be deleted in
 * favour of the other.
 *
 * What *was* avoidable is the rule being written twice. The observation guard
 * used to live in the read path's use case while the rest lived here, so the
 * two halves of one sentence sat in different packages. `market-share-parity.
 * db.test.ts` runs the same operands through both this function and Postgres
 * and asserts they agree, so a change to one that is not made to the other
 * fails rather than quietly reporting a different number on a different screen.
 *
 * `share` is **null, never 0** (spec 0013 §4.3, extended by §4.6). Two ways to
 * be unknown, and they are the same principle twice:
 *   - there is nothing in the market to divide, or
 *   - there is no *known* market: no competitor recorded, and no rep saying
 *     there is none. Reporting 100% there claims we own everything on no
 *     evidence.
 *
 * "We sell nothing here" and "we have no information" must stay
 * distinguishable, and a 0 reads as the former while meaning the latter.
 */
export function deriveShare(
  oursQty: number,
  theirsQty: number,
  noOtherBrands: boolean,
): { totalQty: number; share: number | null } {
  const totalQty = oursQty + theirsQty;
  const marketIsKnown = noOtherBrands || theirsQty > 0;
  return {
    totalQty,
    share: marketIsKnown && totalQty > 0 ? oursQty / totalQty : null,
  };
}

/** Days in the rolling window the headline figure is computed over. */
export const ROLLING_WINDOW_DAYS = 90;

/** The nominal month length used to turn a day-rate into a monthly rate. */
export const DAYS_PER_MONTH = 30;

/**
 * The half-open rolling window `[end - days, end)`.
 *
 * Used for the figure the rep actually reads. Calendar months are the wrong unit
 * there: on the 5th of a month, a trailing three *calendar* months divides two
 * full months plus five days by three, so the number is understated at the start
 * of every month and climbs through it — a clinic selling steadily looks like it
 * is recovering, purely from the calendar.
 *
 * Since §4.6 this is the only window there is: the metric says what is true
 * now, and nothing reads it as a series. The window is also why a nightly pass
 * exists — a stored figure drifts as the calendar moves under it, with no write
 * questions and are not meant to agree exactly.
 */
export function rollingWindow(
  end: Date,
  days: number = ROLLING_WINDOW_DAYS,
): { start: Date; end: Date } {
  if (!Number.isFinite(days) || days <= 0) {
    throw new MarketMetricValidationError(
      "INVALID_WINDOW",
      `Rolling window must be a positive number of days, received ${days}`,
    );
  }
  return { start: new Date(end.getTime() - days * 86_400_000), end };
}

/**
 * A monthly rate from a quantity observed over a number of days.
 *
 * Normalising by the days actually covered is the whole point: no partial period
 * is ever divided as though it were whole.
 */
export function monthlyRateFromDays(
  quantity: number,
  days: number = ROLLING_WINDOW_DAYS,
): number {
  if (!Number.isFinite(days) || days <= 0) {
    throw new MarketMetricValidationError(
      "INVALID_WINDOW",
      `Rolling window must be a positive number of days, received ${days}`,
    );
  }
  return (quantity / days) * DAYS_PER_MONTH;
}

