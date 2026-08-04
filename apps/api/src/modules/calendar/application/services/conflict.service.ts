import {
  calendarRuleEnd,
  iterateEffectiveCalendarOccurrences,
  type CalendarIterationRange,
  type CalendarOccurrence,
  type CalendarOccurrenceOverride,
  type CalendarRecurrenceRule,
} from "./recurrence.service";

export type { CalendarOccurrenceOverride } from "./recurrence.service";

export interface CalendarConflictEntry {
  id: string;
  rule: CalendarRecurrenceRule;
  cancelledOccurrenceKeys?: readonly string[];
  overrides?: Readonly<Record<string, CalendarOccurrenceOverride>>;
}

export interface CalendarConflictRange {
  from: Date;
  to?: Date;
}

export interface CalendarConflict {
  candidateId: string;
  existingId: string;
  candidateOccurrenceKey: string;
  existingOccurrenceKey: string;
  candidateStartsAt: Date;
  candidateEndsAt: Date;
  existingStartsAt: Date;
  existingEndsAt: Date;
}

/** UI feedback is intentionally bounded even when many concrete pairs overlap. */
export const MAX_CALENDAR_CONFLICTS = 100;

const GREGORIAN_CYCLE_YEARS = 400;

/**
 * Finds the globally earliest concrete conflicting pairs using semi-open overlap.
 *
 * An omitted `range.to` is exact for finite rules. For two infinite supported
 * recurrence shapes, comparison covers one representable 400-year Gregorian
 * cycle from `range.from`. That is exact relative to the runtime's installed
 * IANA tzdata projection; future political timezone changes cannot be known.
 */
export function findCalendarConflicts(
  candidate: CalendarConflictEntry,
  existing: readonly CalendarConflictEntry[],
  range: CalendarConflictRange
): CalendarConflict[] {
  validateConflictRange(range);
  if (range.to !== undefined && range.to <= range.from) return [];

  const earliest: CalendarConflict[] = [];
  for (const existingEntry of existing) {
    if (range.to === undefined && simpleDailyNoConflict(candidate, existingEntry)) {
      continue;
    }
    const pairRange = comparisonRange(candidate, existingEntry, range);
    collectPairOverlaps(candidate, existingEntry, pairRange, earliest);
  }
  return earliest.sort(compareConflicts);
}

function validateConflictRange(range: CalendarConflictRange): void {
  if (!Number.isFinite(range.from.getTime())) {
    throw new RangeError("Conflict range requires a valid from date");
  }
  if (range.to !== undefined && !Number.isFinite(range.to.getTime())) {
    throw new RangeError("Conflict range requires a valid to date");
  }
}

function simpleDailyNoConflict(
  candidate: CalendarConflictEntry,
  existing: CalendarConflictEntry
): boolean {
  if (
    hasOccurrenceState(candidate) ||
    hasOccurrenceState(existing) ||
    !isUnboundedDaily(candidate.rule) ||
    !isUnboundedDaily(existing.rule) ||
    candidate.rule.timeZone !== existing.rule.timeZone
  ) {
    return false;
  }

  const candidateStartMinute = localMinute(candidate.rule.anchorLocalTime);
  const existingStartMinute = localMinute(existing.rule.anchorLocalTime);
  if (
    cyclicDailyIntervalsOverlap(
      candidateStartMinute,
      candidate.rule.durationMinutes,
      existingStartMinute,
      existing.rule.durationMinutes
    )
  ) {
    return false;
  }

  // Same-zone daily wall-clock slots undergo identical UTC offset changes.
  // Non-overlap on the circular local day therefore proves non-overlap across
  // the installed tzdata, including DST gaps/folds, without scanning 146097 days.
  return true;
}

function hasOccurrenceState(entry: CalendarConflictEntry): boolean {
  return (
    (entry.cancelledOccurrenceKeys?.length ?? 0) > 0 ||
    Object.keys(entry.overrides ?? {}).length > 0
  );
}

function isUnboundedDaily(rule: CalendarRecurrenceRule): boolean {
  return (
    rule.recurrence === "DAILY" &&
    rule.recurrenceCount === undefined &&
    rule.recurrenceUntil === undefined
  );
}

function localMinute(localTime: string): number {
  const [hour, minute] = localTime.split(":").map(Number);
  return hour! * 60 + minute!;
}

function cyclicDailyIntervalsOverlap(
  leftStart: number,
  leftDuration: number,
  rightStart: number,
  rightDuration: number
): boolean {
  const dayMinutes = 24 * 60;
  for (const shift of [-dayMinutes, 0, dayMinutes]) {
    const shiftedRightStart = rightStart + shift;
    if (
      leftStart < shiftedRightStart + rightDuration &&
      shiftedRightStart < leftStart + leftDuration
    ) {
      return true;
    }
  }
  return false;
}

function comparisonRange(
  candidate: CalendarConflictEntry,
  existing: CalendarConflictEntry,
  range: CalendarConflictRange
): CalendarIterationRange {
  if (range.to !== undefined) return range;

  const candidateEnd = effectiveRuleEnd(candidate);
  const existingEnd = effectiveRuleEnd(existing);
  if (candidateEnd && existingEnd) {
    return {
      from: range.from,
      to: new Date(Math.max(candidateEnd.getTime(), existingEnd.getTime()) + 1),
    };
  }
  if (candidateEnd) {
    const overrideEnd = latestActiveOverrideEnd(existing);
    if (overrideEnd && overrideEnd > candidateEnd) {
      return { from: range.from, to: new Date(overrideEnd.getTime() + 1) };
    }
    return { from: range.from, to: new Date(candidateEnd.getTime() + 1) };
  }
  if (existingEnd) {
    const overrideEnd = latestActiveOverrideEnd(candidate);
    if (overrideEnd && overrideEnd > existingEnd) {
      return { from: range.from, to: new Date(overrideEnd.getTime() + 1) };
    }
    return { from: range.from, to: new Date(existingEnd.getTime() + 1) };
  }

  const to = new Date(range.from);
  to.setUTCFullYear(to.getUTCFullYear() + GREGORIAN_CYCLE_YEARS);
  return { from: range.from, to };
}

function latestActiveOverrideEnd(entry: CalendarConflictEntry): Date | undefined {
  let latest: Date | undefined;
  for (const [recurrenceKey, override] of Object.entries(entry.overrides ?? {})) {
    if (
      override.status === "CANCELLED" ||
      entry.cancelledOccurrenceKeys?.includes(recurrenceKey) ||
      override.endsAt === undefined
    ) {
      continue;
    }
    if (!latest || override.endsAt > latest) latest = override.endsAt;
  }
  return latest;
}

function effectiveRuleEnd(entry: CalendarConflictEntry): Date | undefined {
  const nominalEnd = calendarRuleEnd(entry.rule);
  if (!nominalEnd) return undefined;

  let end = nominalEnd;
  for (const [recurrenceKey, override] of Object.entries(entry.overrides ?? {})) {
    if (
      override.status === "CANCELLED" ||
      entry.cancelledOccurrenceKeys?.includes(recurrenceKey)
    ) {
      continue;
    }
    if (override.endsAt && override.endsAt > end) end = override.endsAt;
  }
  return end;
}

function collectPairOverlaps(
  candidate: CalendarConflictEntry,
  existing: CalendarConflictEntry,
  range: CalendarIterationRange,
  earliest: CalendarConflict[]
): void {
  const candidateIterator = iterateEffectiveCalendarOccurrences(candidate, range);
  const existingIterator = iterateEffectiveCalendarOccurrences(existing, range);
  let candidateNext = candidateIterator.next();
  let existingNext = existingIterator.next();
  const activeCandidates: CalendarOccurrence[] = [];
  const activeExisting: CalendarOccurrence[] = [];

  while (!candidateNext.done || !existingNext.done) {
    const takeCandidate =
      existingNext.done ||
      (!candidateNext.done &&
        compareOccurrences(candidateNext.value, existingNext.value) <= 0);
    const occurrence = takeCandidate ? candidateNext.value : existingNext.value;
    const startsAt = occurrence.startsAt;

    pruneEnded(activeCandidates, startsAt);
    pruneEnded(activeExisting, startsAt);

    if (takeCandidate) {
      for (const existingOccurrence of activeExisting) {
        if (overlaps(occurrence, existingOccurrence)) {
          retainEarliest(
            earliest,
            createConflict(candidate, occurrence, existing, existingOccurrence)
          );
        }
      }
      activeCandidates.push(occurrence);
      candidateNext = candidateIterator.next();
    } else {
      for (const candidateOccurrence of activeCandidates) {
        if (overlaps(candidateOccurrence, occurrence)) {
          retainEarliest(
            earliest,
            createConflict(candidate, candidateOccurrence, existing, occurrence)
          );
        }
      }
      activeExisting.push(occurrence);
      existingNext = existingIterator.next();
    }

    const nextStart = minimumNextStart(candidateNext, existingNext);
    const cutoff = latestRetainedPairStart(earliest);
    if (
      earliest.length === MAX_CALENDAR_CONFLICTS &&
      cutoff !== undefined &&
      nextStart !== undefined &&
      nextStart > cutoff
    ) {
      return;
    }
  }
}

function pruneEnded(active: CalendarOccurrence[], startsAt: Date): void {
  let writeIndex = 0;
  for (const occurrence of active) {
    if (occurrence.endsAt > startsAt) {
      active[writeIndex] = occurrence;
      writeIndex += 1;
    }
  }
  active.length = writeIndex;
}

function minimumNextStart(
  candidate: IteratorResult<CalendarOccurrence>,
  existing: IteratorResult<CalendarOccurrence>
): Date | undefined {
  if (candidate.done) return existing.done ? undefined : existing.value.startsAt;
  if (existing.done) return candidate.value.startsAt;
  return candidate.value.startsAt <= existing.value.startsAt
    ? candidate.value.startsAt
    : existing.value.startsAt;
}

function latestRetainedPairStart(conflicts: readonly CalendarConflict[]): Date | undefined {
  if (conflicts.length < MAX_CALENDAR_CONFLICTS) return undefined;
  return pairStart(conflicts[conflicts.length - 1]!);
}

function retainEarliest(
  conflicts: CalendarConflict[],
  conflict: CalendarConflict
): void {
  let low = 0;
  let high = conflicts.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (compareConflicts(conflicts[middle]!, conflict) <= 0) low = middle + 1;
    else high = middle;
  }
  conflicts.splice(low, 0, conflict);
  if (conflicts.length > MAX_CALENDAR_CONFLICTS) conflicts.pop();
}

function createConflict(
  candidate: CalendarConflictEntry,
  candidateOccurrence: CalendarOccurrence,
  existing: CalendarConflictEntry,
  existingOccurrence: CalendarOccurrence
): CalendarConflict {
  return {
    candidateId: candidate.id,
    existingId: existing.id,
    candidateOccurrenceKey: candidateOccurrence.recurrenceKey,
    existingOccurrenceKey: existingOccurrence.recurrenceKey,
    candidateStartsAt: candidateOccurrence.startsAt,
    candidateEndsAt: candidateOccurrence.endsAt,
    existingStartsAt: existingOccurrence.startsAt,
    existingEndsAt: existingOccurrence.endsAt,
  };
}

function overlaps(left: CalendarOccurrence, right: CalendarOccurrence): boolean {
  return left.startsAt < right.endsAt && right.startsAt < left.endsAt;
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

function pairStart(conflict: CalendarConflict): Date {
  return conflict.candidateStartsAt >= conflict.existingStartsAt
    ? conflict.candidateStartsAt
    : conflict.existingStartsAt;
}

function compareConflicts(left: CalendarConflict, right: CalendarConflict): number {
  return (
    pairStart(left).getTime() - pairStart(right).getTime() ||
    left.candidateStartsAt.getTime() - right.candidateStartsAt.getTime() ||
    left.existingStartsAt.getTime() - right.existingStartsAt.getTime() ||
    left.existingId.localeCompare(right.existingId) ||
    left.candidateOccurrenceKey.localeCompare(right.candidateOccurrenceKey) ||
    left.existingOccurrenceKey.localeCompare(right.existingOccurrenceKey)
  );
}
