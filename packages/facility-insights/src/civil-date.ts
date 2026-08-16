/**
 * Civil dates in the zone the business actually works in.
 *
 * `orders.ordered_at` is an instant. Everything a rep reads off it — which month
 * a sale counts for, which day a clinic last bought — is a *civil* date, and the
 * only civil date that means anything to them is São Paulo's. Truncating in UTC
 * files the last three hours of every Brazilian day under tomorrow, which is
 * roughly an eighth of the working day.
 *
 * Split out of `market-metric.ts` because the purchase funnel needs the same
 * rule and had been applying UTC instead.
 */

export const APPLICATION_TIMEZONE = "America/Sao_Paulo";

export type CivilDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export function partsAt(instant: Date, timeZone: string): CivilDateParts {
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

/**
 * The `YYYY-MM-DD` an instant falls on in [timeZone].
 *
 * Pure: the caller supplies the instant, so this is safe to call from a Temporal
 * workflow. `Intl` is available inside the workflow sandbox — the sandbox
 * replaces `Date`, `Math.random` and the timers, not the whole global surface —
 * and the formatter reads no clock of its own.
 */
export function civilDateAt(
  instant: Date,
  timeZone: string = APPLICATION_TIMEZONE,
): string {
  const local = partsAt(instant, timeZone);
  return [
    String(local.year).padStart(4, "0"),
    String(local.month).padStart(2, "0"),
    String(local.day).padStart(2, "0"),
  ].join("-");
}
