import {
  expandCalendarOccurrences,
  type CalendarExpansionRange,
  type CalendarOccurrence,
  type CalendarRecurrenceRule,
} from "./recurrence.service";

export interface CalendarOccurrenceOverride {
  status?: "ACTIVE" | "CANCELLED";
  startsAt?: Date;
  endsAt?: Date;
}

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
 * Finds concrete conflicting occurrence pairs using semi-open overlap.
 *
 * A caller may omit `range.to` for an unbounded recurrence comparison. The
 * approved recurrence set repeats its Gregorian date/weekday and DST rules over
 * a 400-year calendar cycle, so the search is bounded to one such cycle rather
 * than an arbitrary product horizon such as 12 or 24 months.
 */
export function findCalendarConflicts(
  candidate: CalendarConflictEntry,
  existing: readonly CalendarConflictEntry[],
  range: CalendarConflictRange
): CalendarConflict[] {
  const expansionRange = resolveExpansionRange(range);
  const candidateOccurrences = applyOccurrenceState(
    expandCalendarOccurrences(candidate.rule, expansionRange),
    candidate
  );
  const conflicts: CalendarConflict[] = [];

  for (const existingEntry of existing) {
    const existingOccurrences = applyOccurrenceState(
      expandCalendarOccurrences(existingEntry.rule, expansionRange),
      existingEntry
    );
    collectOverlaps(
      candidate,
      candidateOccurrences,
      existingEntry,
      existingOccurrences,
      conflicts
    );
    if (conflicts.length >= MAX_CALENDAR_CONFLICTS) break;
  }

  return conflicts
    .sort(compareConflicts)
    .slice(0, MAX_CALENDAR_CONFLICTS);
}

function resolveExpansionRange(range: CalendarConflictRange): CalendarExpansionRange {
  if (!Number.isFinite(range.from.getTime())) {
    throw new RangeError("Conflict range requires a valid from date");
  }

  const to = range.to ?? addUtcYears(range.from, GREGORIAN_CYCLE_YEARS);
  if (!Number.isFinite(to.getTime()) || range.from >= to) {
    throw new RangeError("Conflict range requires from < to");
  }
  return { from: range.from, to };
}

function addUtcYears(date: Date, years: number): Date {
  const result = new Date(date);
  result.setUTCFullYear(result.getUTCFullYear() + years);
  return result;
}

function applyOccurrenceState(
  occurrences: readonly CalendarOccurrence[],
  entry: CalendarConflictEntry
): CalendarOccurrence[] {
  const cancelled = new Set(entry.cancelledOccurrenceKeys ?? []);

  return occurrences.flatMap((occurrence) => {
    const override = entry.overrides?.[occurrence.recurrenceKey];
    if (cancelled.has(occurrence.recurrenceKey) || override?.status === "CANCELLED") {
      return [];
    }

    const startsAt = override?.startsAt ?? occurrence.startsAt;
    const endsAt = override?.endsAt ?? occurrence.endsAt;
    if (
      !Number.isFinite(startsAt.getTime()) ||
      !Number.isFinite(endsAt.getTime()) ||
      startsAt >= endsAt
    ) {
      throw new RangeError(
        `Calendar override ${occurrence.recurrenceKey} requires startsAt < endsAt`
      );
    }

    return [{ ...occurrence, startsAt, endsAt }];
  });
}

function collectOverlaps(
  candidate: CalendarConflictEntry,
  candidateOccurrences: readonly CalendarOccurrence[],
  existing: CalendarConflictEntry,
  existingOccurrences: readonly CalendarOccurrence[],
  conflicts: CalendarConflict[]
): void {
  let firstPotentialExistingIndex = 0;

  for (const candidateOccurrence of candidateOccurrences) {
    while (
      firstPotentialExistingIndex < existingOccurrences.length &&
      existingOccurrences[firstPotentialExistingIndex]!.endsAt <=
        candidateOccurrence.startsAt
    ) {
      firstPotentialExistingIndex += 1;
    }

    for (
      let index = firstPotentialExistingIndex;
      index < existingOccurrences.length &&
      existingOccurrences[index]!.startsAt < candidateOccurrence.endsAt;
      index += 1
    ) {
      const existingOccurrence = existingOccurrences[index]!;
      if (!overlaps(candidateOccurrence, existingOccurrence)) continue;

      conflicts.push({
        candidateId: candidate.id,
        existingId: existing.id,
        candidateOccurrenceKey: candidateOccurrence.recurrenceKey,
        existingOccurrenceKey: existingOccurrence.recurrenceKey,
        candidateStartsAt: candidateOccurrence.startsAt,
        candidateEndsAt: candidateOccurrence.endsAt,
        existingStartsAt: existingOccurrence.startsAt,
        existingEndsAt: existingOccurrence.endsAt,
      });
      if (conflicts.length >= MAX_CALENDAR_CONFLICTS) return;
    }
  }
}

function overlaps(
  left: CalendarOccurrence,
  right: CalendarOccurrence
): boolean {
  return left.startsAt < right.endsAt && right.startsAt < left.endsAt;
}

function compareConflicts(left: CalendarConflict, right: CalendarConflict): number {
  return (
    left.candidateStartsAt.getTime() - right.candidateStartsAt.getTime() ||
    left.existingStartsAt.getTime() - right.existingStartsAt.getTime() ||
    left.existingId.localeCompare(right.existingId) ||
    left.candidateOccurrenceKey.localeCompare(right.candidateOccurrenceKey) ||
    left.existingOccurrenceKey.localeCompare(right.existingOccurrenceKey)
  );
}
