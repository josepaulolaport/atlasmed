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

export interface CalendarIterationRange {
  from: Date;
  to?: Date;
}

export interface CalendarOccurrence {
  /** Stable identity derived from the original wall-clock slot, before overrides. */
  recurrenceKey: string;
  localOccurrence: string;
  startsAt: Date;
  endsAt: Date;
}

export interface CalendarOccurrenceOverride {
  status?: "ACTIVE" | "CANCELLED";
  startsAt?: Date;
  endsAt?: Date;
}

export interface EffectiveCalendarOccurrenceRule {
  rule: CalendarRecurrenceRule;
  cancelledOccurrenceKeys?: readonly string[];
  overrides?: Readonly<Record<string, CalendarOccurrenceOverride>>;
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
const RECURRENCE_KEY_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})\[(.+)]$/;
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
  if (
    Number.isFinite(range.from.getTime()) &&
    Number.isFinite(range.to.getTime()) &&
    range.to <= range.from
  ) {
    return [];
  }
  return [...iterateCalendarOccurrences(rule, range)];
}

/**
 * Lazily yields effective rule occurrences in chronological order. An omitted
 * `to` is intentionally unbounded: callers must stop after reaching their own
 * result cap or after the iterator ends for NONE/count/until-limited rules.
 */
export function* iterateCalendarOccurrences(
  rule: CalendarRecurrenceRule,
  range: CalendarIterationRange
): Generator<CalendarOccurrence> {
  assertValidRule(rule);
  if (
    !Number.isFinite(range.from.getTime()) ||
    (range.to !== undefined &&
      (!Number.isFinite(range.to.getTime()) || range.from >= range.to))
  ) {
    throw new RangeError("Calendar expansion requires a valid range with from < to");
  }

  const anchorDate = parseDate(rule.anchorLocalDate);
  const { hour, minute } = parseTime(rule.anchorLocalTime);
  const firstIndex = estimateFirstIndex(rule, anchorDate, range.from);

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

    if (range.to !== undefined && startsAt >= range.to) break;
    if (range.from < endsAt) {
      const localOccurrence = `${localDateString}T${rule.anchorLocalTime}`;
      yield {
        recurrenceKey: `${localOccurrence}[${rule.timeZone}]`,
        localOccurrence,
        startsAt,
        endsAt,
      };
    }

    if (rule.recurrence === "NONE") break;
  }
}

/**
 * Lazily merges base recurrence slots with finite cancellations and overrides.
 * Override keys suppress their original base slots, while active moved slots
 * are merged back by effective UTC start time without expanding the series.
 */
export function* iterateEffectiveCalendarOccurrences(
  entry: EffectiveCalendarOccurrenceRule,
  range: CalendarIterationRange
): Generator<CalendarOccurrence> {
  if (
    !Number.isFinite(range.from.getTime()) ||
    (range.to !== undefined && !Number.isFinite(range.to.getTime()))
  ) {
    throw new RangeError("Calendar expansion requires valid range dates");
  }
  if (range.to !== undefined && range.to <= range.from) return;

  const cancelled = new Set(entry.cancelledOccurrenceKeys ?? []);
  const suppressed = new Set(Object.keys(entry.overrides ?? {}));
  const overrideOccurrences: CalendarOccurrence[] = [];

  for (const [recurrenceKey, override] of Object.entries(entry.overrides ?? {})) {
    if (cancelled.has(recurrenceKey) || override.status === "CANCELLED") continue;

    const original = calendarOccurrenceFromRecurrenceKey(entry.rule, recurrenceKey);
    if (!original) continue;
    const startsAt = override.startsAt ?? original.startsAt;
    const endsAt = override.endsAt ?? original.endsAt;
    assertValidOverride(recurrenceKey, startsAt, endsAt);
    if (endsAt <= range.from || (range.to !== undefined && startsAt >= range.to)) {
      continue;
    }
    overrideOccurrences.push({ ...original, startsAt, endsAt });
  }
  overrideOccurrences.sort(compareOccurrences);

  const baseIterator = iterateCalendarOccurrences(entry.rule, range);
  let base = nextUnsuppressedBase(baseIterator, cancelled, suppressed);
  let overrideIndex = 0;

  while (base || overrideIndex < overrideOccurrences.length) {
    const override = overrideOccurrences[overrideIndex];
    if (!base || (override && compareOccurrences(override, base) <= 0)) {
      yield override!;
      overrideIndex += 1;
    } else {
      yield base;
      base = nextUnsuppressedBase(baseIterator, cancelled, suppressed);
    }
  }
}

function nextUnsuppressedBase(
  iterator: Generator<CalendarOccurrence>,
  cancelled: ReadonlySet<string>,
  suppressed: ReadonlySet<string>
): CalendarOccurrence | undefined {
  for (let next = iterator.next(); !next.done; next = iterator.next()) {
    if (
      !cancelled.has(next.value.recurrenceKey) &&
      !suppressed.has(next.value.recurrenceKey)
    ) {
      return next.value;
    }
  }
  return undefined;
}

function assertValidOverride(
  recurrenceKey: string,
  startsAt: Date,
  endsAt: Date
): void {
  if (
    !Number.isFinite(startsAt.getTime()) ||
    !Number.isFinite(endsAt.getTime()) ||
    startsAt >= endsAt
  ) {
    throw new RangeError(
      `Calendar override ${recurrenceKey} requires startsAt < endsAt`
    );
  }
}

function compareOccurrences(
  left: CalendarOccurrence,
  right: CalendarOccurrence
): number {
  return (
    left.startsAt.getTime() - right.startsAt.getTime() ||
    left.endsAt.getTime() - right.endsAt.getTime() ||
    left.recurrenceKey.localeCompare(right.recurrenceKey)
  );
}

export function calendarRuleEnd(rule: CalendarRecurrenceRule): Date | undefined {
  assertValidRule(rule);
  if (
    rule.recurrence !== "NONE" &&
    rule.recurrenceCount === undefined &&
    rule.recurrenceUntil === undefined
  ) {
    return undefined;
  }

  const anchor = parseDate(rule.anchorLocalDate);
  let lastIndex = rule.recurrence === "NONE" ? 0 : Number.POSITIVE_INFINITY;
  if (rule.recurrenceCount !== undefined) {
    lastIndex = Math.min(lastIndex, rule.recurrenceCount - 1);
  }
  if (rule.recurrenceUntil !== undefined) {
    const until = parseDate(rule.recurrenceUntil);
    lastIndex = Math.min(
      lastIndex,
      lastOccurrenceIndexOnOrBefore(anchor, rule.recurrence, until)
    );
  }
  if (!Number.isFinite(lastIndex) || lastIndex < 0) return new Date(0);

  const occurrence = calendarOccurrenceAtIndex(rule, anchor, lastIndex);
  return occurrence.endsAt;
}

export function calendarOccurrenceFromRecurrenceKey(
  rule: CalendarRecurrenceRule,
  recurrenceKey: string
): CalendarOccurrence | undefined {
  assertValidRule(rule);
  const match = RECURRENCE_KEY_PATTERN.exec(recurrenceKey);
  if (!match || match[3] !== rule.timeZone) return undefined;

  const localDateString = match[1]!;
  const localTime = match[2]!;
  if (localTime !== rule.anchorLocalTime) return undefined;

  const localDate = parseDate(localDateString);
  const index = occurrenceIndex(parseDate(rule.anchorLocalDate), rule.recurrence, localDate);
  if (index === undefined) return undefined;
  if (rule.recurrenceCount !== undefined && index >= rule.recurrenceCount) return undefined;
  if (rule.recurrenceUntil !== undefined && localDateString > rule.recurrenceUntil) {
    return undefined;
  }

  const { hour, minute } = parseTime(localTime);
  const startsAt = localDateTimeToUtc({ ...localDate, hour, minute }, rule.timeZone);
  return {
    recurrenceKey,
    localOccurrence: `${localDateString}T${localTime}`,
    startsAt,
    endsAt: new Date(startsAt.getTime() + rule.durationMinutes * MINUTE_MS),
  };
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

function calendarOccurrenceAtIndex(
  rule: CalendarRecurrenceRule,
  anchor: LocalDate,
  index: number
): CalendarOccurrence {
  const localDate = occurrenceDate(anchor, rule.recurrence, index);
  const localDateString = formatDate(localDate);
  const { hour, minute } = parseTime(rule.anchorLocalTime);
  const startsAt = localDateTimeToUtc({ ...localDate, hour, minute }, rule.timeZone);
  const localOccurrence = `${localDateString}T${rule.anchorLocalTime}`;
  return {
    recurrenceKey: `${localOccurrence}[${rule.timeZone}]`,
    localOccurrence,
    startsAt,
    endsAt: new Date(startsAt.getTime() + rule.durationMinutes * MINUTE_MS),
  };
}

function lastOccurrenceIndexOnOrBefore(
  anchor: LocalDate,
  recurrence: CalendarRecurrence,
  until: LocalDate
): number {
  if (dateOrdinal(until) < dateOrdinal(anchor)) return -1;

  let estimate: number;
  switch (recurrence) {
    case "NONE":
      return 0;
    case "DAILY":
      estimate = Math.floor((dateOrdinal(until) - dateOrdinal(anchor)) / DAY_MS);
      break;
    case "WEEKLY":
      estimate = Math.floor(
        (dateOrdinal(until) - dateOrdinal(anchor)) / (7 * DAY_MS)
      );
      break;
    case "MONTHLY":
      estimate =
        (until.year - anchor.year) * 12 + (until.month - anchor.month);
      break;
    case "YEARLY":
      estimate = until.year - anchor.year;
      break;
  }

  while (
    estimate >= 0 &&
    dateOrdinal(occurrenceDate(anchor, recurrence, estimate)) > dateOrdinal(until)
  ) {
    estimate -= 1;
  }
  return estimate;
}

function occurrenceIndex(
  anchor: LocalDate,
  recurrence: CalendarRecurrence,
  localDate: LocalDate
): number | undefined {
  let index: number;
  switch (recurrence) {
    case "NONE":
      index = 0;
      break;
    case "DAILY":
      index = (dateOrdinal(localDate) - dateOrdinal(anchor)) / DAY_MS;
      break;
    case "WEEKLY":
      index = (dateOrdinal(localDate) - dateOrdinal(anchor)) / (7 * DAY_MS);
      break;
    case "MONTHLY":
      index =
        (localDate.year - anchor.year) * 12 + (localDate.month - anchor.month);
      break;
    case "YEARLY":
      index = localDate.year - anchor.year;
      break;
  }

  if (!Number.isInteger(index) || index < 0) return undefined;
  const expected = occurrenceDate(anchor, recurrence, index);
  return formatDate(expected) === formatDate(localDate) ? index : undefined;
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
