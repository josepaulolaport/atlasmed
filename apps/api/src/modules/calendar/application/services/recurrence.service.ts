export type CalendarRecurrence =
  | "NONE"
  | "DAILY"
  | "WEEKLY"
  | "MONTHLY"
  | "YEARLY";

export interface CalendarRecurrenceRule {
  anchorLocalDate: string;
  anchorLocalTime: string;
  timeZone: string;
  durationMinutes: number;
  recurrence: CalendarRecurrence;
  /** Inclusive local calendar date. */
  recurrenceUntil?: string;
  /** Maximum occurrences counted from the anchor, before range filtering. */
  recurrenceCount?: number;
}

export interface CalendarExpansionRange {
  from: Date;
  to: Date;
}

export interface CalendarOccurrence {
  /** Stable identity derived from the original wall-clock slot, before overrides. */
  recurrenceKey: string;
  localOccurrence: string;
  startsAt: Date;
  endsAt: Date;
}

interface LocalDate {
  year: number;
  month: number;
  day: number;
}

interface LocalDateTime extends LocalDate {
  hour: number;
  minute: number;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})$/;
const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const formatterCache = new Map<string, Intl.DateTimeFormat>();

/**
 * Expands occurrences whose semi-open interval intersects `[from, to)`.
 * Therefore an occurrence that starts before `from` and ends after `from` is
 * included, while one ending exactly at `from` or starting exactly at `to` is not.
 */
export function expandCalendarOccurrences(
  rule: CalendarRecurrenceRule,
  range: CalendarExpansionRange
): CalendarOccurrence[] {
  assertValidRule(rule);
  if (
    !Number.isFinite(range.from.getTime()) ||
    !Number.isFinite(range.to.getTime()) ||
    range.from >= range.to
  ) {
    throw new RangeError("Calendar expansion requires a valid range with from < to");
  }

  const anchorDate = parseDate(rule.anchorLocalDate);
  const { hour, minute } = parseTime(rule.anchorLocalTime);
  const firstIndex = estimateFirstIndex(rule, anchorDate, range.from);
  const occurrences: CalendarOccurrence[] = [];

  for (let index = firstIndex; ; index += 1) {
    if (rule.recurrenceCount !== undefined && index >= rule.recurrenceCount) break;

    const localDate = occurrenceDate(anchorDate, rule.recurrence, index);
    const localDateString = formatDate(localDate);
    if (
      rule.recurrenceUntil !== undefined &&
      localDateString > rule.recurrenceUntil
    ) {
      break;
    }

    const localDateTime = { ...localDate, hour, minute };
    const startsAt = localDateTimeToUtc(localDateTime, rule.timeZone);
    const endsAt = new Date(startsAt.getTime() + rule.durationMinutes * MINUTE_MS);

    if (startsAt >= range.to) break;
    if (startsAt < range.to && range.from < endsAt) {
      const localOccurrence = `${localDateString}T${rule.anchorLocalTime}`;
      occurrences.push({
        recurrenceKey: `${localOccurrence}[${rule.timeZone}]`,
        localOccurrence,
        startsAt,
        endsAt,
      });
    }

    if (rule.recurrence === "NONE") break;
  }

  return occurrences;
}

function assertValidRule(rule: CalendarRecurrenceRule): void {
  parseDate(rule.anchorLocalDate);
  parseTime(rule.anchorLocalTime);
  new Intl.DateTimeFormat("en-US", { timeZone: rule.timeZone }).format(0);

  if (!Number.isInteger(rule.durationMinutes) || rule.durationMinutes <= 0) {
    throw new RangeError("durationMinutes must be a positive integer");
  }
  if (
    rule.recurrenceCount !== undefined &&
    (!Number.isInteger(rule.recurrenceCount) || rule.recurrenceCount <= 0)
  ) {
    throw new RangeError("recurrenceCount must be a positive integer");
  }
  if (rule.recurrenceUntil !== undefined) parseDate(rule.recurrenceUntil);
}

function parseDate(value: string): LocalDate {
  const match = DATE_PATTERN.exec(value);
  if (!match) throw new RangeError(`Invalid local date: ${value}`);

  const date = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
  if (
    date.month < 1 ||
    date.month > 12 ||
    date.day < 1 ||
    date.day > daysInMonth(date.year, date.month)
  ) {
    throw new RangeError(`Invalid local date: ${value}`);
  }
  return date;
}

function parseTime(value: string): Pick<LocalDateTime, "hour" | "minute"> {
  const match = TIME_PATTERN.exec(value);
  if (!match) throw new RangeError(`Invalid local time: ${value}`);

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    throw new RangeError(`Invalid local time: ${value}`);
  }
  return { hour, minute };
}

function occurrenceDate(
  anchor: LocalDate,
  recurrence: CalendarRecurrence,
  index: number
): LocalDate {
  switch (recurrence) {
    case "NONE":
      return anchor;
    case "DAILY":
      return addDays(anchor, index);
    case "WEEKLY":
      return addDays(anchor, index * 7);
    case "MONTHLY": {
      const absoluteMonth = anchor.year * 12 + (anchor.month - 1) + index;
      const year = Math.floor(absoluteMonth / 12);
      const month = (absoluteMonth % 12) + 1;
      return {
        year,
        month,
        day: Math.min(anchor.day, daysInMonth(year, month)),
      };
    }
    case "YEARLY": {
      const year = anchor.year + index;
      return {
        year,
        month: anchor.month,
        day: Math.min(anchor.day, daysInMonth(year, anchor.month)),
      };
    }
  }
}

function estimateFirstIndex(
  rule: CalendarRecurrenceRule,
  anchor: LocalDate,
  from: Date
): number {
  if (rule.recurrence === "NONE") return 0;

  const earliestRelevantInstant = new Date(
    from.getTime() - rule.durationMinutes * MINUTE_MS
  );
  const local = utcToLocalDateTime(earliestRelevantInstant, rule.timeZone);
  let estimate = 0;

  switch (rule.recurrence) {
    case "DAILY":
      estimate = Math.floor((dateOrdinal(local) - dateOrdinal(anchor)) / DAY_MS);
      break;
    case "WEEKLY":
      estimate = Math.floor(
        (dateOrdinal(local) - dateOrdinal(anchor)) / (7 * DAY_MS)
      );
      break;
    case "MONTHLY":
      estimate =
        (local.year - anchor.year) * 12 + (local.month - anchor.month);
      break;
    case "YEARLY":
      estimate = local.year - anchor.year;
      break;
  }

  return Math.max(0, estimate - 1);
}

function addDays(date: LocalDate, days: number): LocalDate {
  const result = new Date(dateOrdinal(date) + days * DAY_MS);
  return {
    year: result.getUTCFullYear(),
    month: result.getUTCMonth() + 1,
    day: result.getUTCDate(),
  };
}

function dateOrdinal(date: LocalDate): number {
  const result = new Date(0);
  result.setUTCHours(0, 0, 0, 0);
  result.setUTCFullYear(date.year, date.month - 1, date.day);
  return result.getTime();
}

function daysInMonth(year: number, month: number): number {
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month, 0);
  return date.getUTCDate();
}

function formatDate(date: LocalDate): string {
  return `${pad(date.year, 4)}-${pad(date.month)}-${pad(date.day)}`;
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA-u-ca-gregory-nu-latn", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

function utcToLocalDateTime(instant: Date, timeZone: string): LocalDateTime {
  const parts = getFormatter(timeZone).formatToParts(instant);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );

  return {
    year: values.year!,
    month: values.month!,
    day: values.day!,
    hour: values.hour!,
    minute: values.minute!,
  };
}

function comparableLocalValue(local: LocalDateTime): number {
  const date = new Date(0);
  date.setUTCSeconds(0, 0);
  date.setUTCFullYear(
    local.year,
    local.month - 1,
    local.day
  );
  date.setUTCHours(local.hour, local.minute, 0, 0);
  return date.getTime();
}

/**
 * Intl-based wall-clock conversion with Temporal-compatible disambiguation:
 * the earlier instant is selected for a repeated time, and a missing time is
 * shifted forward by the DST gap.
 */
function localDateTimeToUtc(local: LocalDateTime, timeZone: string): Date {
  const desiredLocalValue = comparableLocalValue(local);
  const offsets = new Set<number>();

  for (const probeDelta of [-36, -12, 0, 12, 36]) {
    const probe = new Date(desiredLocalValue + probeDelta * 60 * MINUTE_MS);
    offsets.add(comparableLocalValue(utcToLocalDateTime(probe, timeZone)) - probe.getTime());
  }

  const candidates = [...offsets]
    .map((offset) => new Date(desiredLocalValue - offset))
    .sort((left, right) => left.getTime() - right.getTime());
  const exact = candidates.find(
    (candidate) =>
      comparableLocalValue(utcToLocalDateTime(candidate, timeZone)) ===
      desiredLocalValue
  );
  if (exact) return exact;

  const shiftedForward = candidates
    .map((candidate) => ({
      candidate,
      localValue: comparableLocalValue(utcToLocalDateTime(candidate, timeZone)),
    }))
    .filter(({ localValue }) => localValue > desiredLocalValue)
    .sort((left, right) => left.localValue - right.localValue)[0];

  if (shiftedForward) return shiftedForward.candidate;
  throw new RangeError(
    `Unable to resolve ${formatDate(local)}T${pad(local.hour)}:${pad(local.minute)} in ${timeZone}`
  );
}
