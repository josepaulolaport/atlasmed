import {
  calendarOccurrenceFromRecurrenceKey,
  calendarRuleEnd,
  expandCalendarOccurrences,
  iterateCalendarOccurrences,
  type CalendarExpansionRange,
  type CalendarIterationRange,
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

/**
 * Finds concrete conflicting occurrence pairs using semi-open overlap.
 *
 * A caller may omit `range.to` for an unbounded comparison. In that mode,
 * recurring rules are consumed lazily and stop as soon as the conflict cap is
 * reached. If two infinite rules never overlap, supported calendar patterns
 * are checked for one 400-year Gregorian date/weekday cycle and then stop.
 * This is a termination bound for the supported recurrence shapes, not a claim
 * that historical or future IANA time-zone rules repeat every 400 years.
 */
export function findCalendarConflicts(
  candidate: CalendarConflictEntry,
  existing: readonly CalendarConflictEntry[],
  range: CalendarConflictRange
): CalendarConflict[] {
  validateConflictRange(range);
  const conflicts: CalendarConflict[] = [];

  for (const existingEntry of existing) {
    if (range.to === undefined && isSimpleUnboundedPair(candidate, existingEntry)) {
      collectUnboundedOverlaps(candidate, existingEntry, range.from, conflicts);
    } else {
      const expansionRange = resolveFiniteExpansionRange(
        candidate,
        existingEntry,
        range
      );
      const candidateOccurrences = effectiveOccurrences(candidate, expansionRange);
      const existingOccurrences = effectiveOccurrences(existingEntry, expansionRange);
      collectOverlaps(
        candidate,
        candidateOccurrences,
        existingEntry,
        existingOccurrences,
        conflicts
      );
    }
    if (conflicts.length >= MAX_CALENDAR_CONFLICTS) break;
  }

  return conflicts
    .sort(compareConflicts)
    .slice(0, MAX_CALENDAR_CONFLICTS);
}

function validateConflictRange(range: CalendarConflictRange): void {
  if (!Number.isFinite(range.from.getTime())) {
    throw new RangeError("Conflict range requires a valid from date");
  }
  if (
    range.to !== undefined &&
    (!Number.isFinite(range.to.getTime()) || range.from >= range.to)
  ) {
    throw new RangeError("Conflict range requires from < to");
  }
}

function resolveFiniteExpansionRange(
  candidate: CalendarConflictEntry,
  existing: CalendarConflictEntry,
  range: CalendarConflictRange
): CalendarExpansionRange {
  if (range.to !== undefined) return { from: range.from, to: range.to };

  const ends = [finiteRuleEnd(candidate.rule), finiteRuleEnd(existing.rule)].filter(
    (value): value is Date => value !== undefined
  );
  if (ends.length === 0) {
    throw new RangeError(
      "Unbounded calendar comparisons with overrides require at least one finite recurrence"
    );
  }
  return { from: range.from, to: new Date(Math.max(...ends.map((end) => end.getTime()))) };
}

function isSimpleUnboundedPair(
  candidate: CalendarConflictEntry,
  existing: CalendarConflictEntry
): boolean {
  return !hasOccurrenceState(candidate) && !hasOccurrenceState(existing);
}

function hasOccurrenceState(entry: CalendarConflictEntry): boolean {
  return (
    (entry.cancelledOccurrenceKeys?.length ?? 0) > 0 ||
    Object.keys(entry.overrides ?? {}).length > 0
  );
}

function finiteRuleEnd(rule: CalendarRecurrenceRule): Date | undefined {
  return calendarRuleEnd(rule);
}

function collectUnboundedOverlaps(
  candidate: CalendarConflictEntry,
  existing: CalendarConflictEntry,
  from: Date,
  conflicts: CalendarConflict[]
): void {
  const range = unboundedIterationRange(candidate.rule, existing.rule, from);
  const candidateIterator = iterateCalendarOccurrences(candidate.rule, range);
  const existingIterator = iterateCalendarOccurrences(existing.rule, range);
  let candidateOccurrence = candidateIterator.next().value;
  let existingOccurrence = existingIterator.next().value;

  while (candidateOccurrence && existingOccurrence) {
    if (overlaps(candidateOccurrence, existingOccurrence)) {
      conflicts.push(
        createConflict(candidate, candidateOccurrence, existing, existingOccurrence)
      );
      if (conflicts.length >= MAX_CALENDAR_CONFLICTS) return;
    }

    if (candidateOccurrence.endsAt <= existingOccurrence.endsAt) {
      candidateOccurrence = candidateIterator.next().value;
    } else {
      existingOccurrence = existingIterator.next().value;
    }
  }
}

function unboundedIterationRange(
  candidate: CalendarRecurrenceRule,
  existing: CalendarRecurrenceRule,
  from: Date
): CalendarIterationRange {
  if (finiteRuleEnd(candidate) || finiteRuleEnd(existing)) return { from };

  const to = new Date(from);
  to.setUTCFullYear(to.getUTCFullYear() + 400);
  return { from, to };
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

function effectiveOccurrences(
  entry: CalendarConflictEntry,
  range: CalendarExpansionRange
): CalendarOccurrence[] {
  const cancelled = new Set(entry.cancelledOccurrenceKeys ?? []);
  const occurrences = new Map(
    expandCalendarOccurrences(entry.rule, range).map((occurrence) => [
      occurrence.recurrenceKey,
      occurrence,
    ])
  );

  for (const recurrenceKey of Object.keys(entry.overrides ?? {})) {
    if (occurrences.has(recurrenceKey)) continue;
    const occurrence = calendarOccurrenceFromRecurrenceKey(entry.rule, recurrenceKey);
    if (occurrence) occurrences.set(recurrenceKey, occurrence);
  }

  return [...occurrences.values()]
    .flatMap((occurrence) => {
      const override = entry.overrides?.[occurrence.recurrenceKey];
      if (
        cancelled.has(occurrence.recurrenceKey) ||
        override?.status === "CANCELLED"
      ) {
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
      if (startsAt >= range.to || endsAt <= range.from) return [];

      return [{ ...occurrence, startsAt, endsAt }];
    })
    .sort(
      (left, right) =>
        left.startsAt.getTime() - right.startsAt.getTime() ||
        left.endsAt.getTime() - right.endsAt.getTime() ||
        left.recurrenceKey.localeCompare(right.recurrenceKey)
    );
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

      conflicts.push(
        createConflict(candidate, candidateOccurrence, existing, existingOccurrence)
      );
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
