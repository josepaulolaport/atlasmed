import { calendarLocalAnchorAt, calendarOccurrenceFromRecurrenceKey } from "../../../calendar/application/services/recurrence.service";

/**
 * The default end of a working day, matching the linha's own (§15.5.5).
 *
 * Kept here rather than read from `roteiro_params`: this module has no business
 * knowing about verticals, and the number is only used to decide how long a rep
 * may still be recording today's visits.
 */
export const DEFAULT_WORKDAY_END = "18:00";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** `hh:mm` on the local day that [instant] falls in, as an instant. */
export function endOfWorkday(instant: Date, timeZone: string, workdayEnd: string | null | undefined): Date {
  const time = typeof workdayEnd === "string" && HHMM.test(workdayEnd) ? workdayEnd : DEFAULT_WORKDAY_END;
  const { anchorLocalDate } = calendarLocalAnchorAt(instant, timeZone);
  // Resolved through the calendar's own expansion so a DST boundary lands where
  // the rest of the app puts it, rather than by adding hours to a UTC number.
  const occurrence = calendarOccurrenceFromRecurrenceKey(
    { anchorLocalDate, anchorLocalTime: time, timeZone, durationMinutes: 30, recurrence: "NONE" },
    `${anchorLocalDate}T${time}[${timeZone}]`,
  );
  return occurrence?.startsAt ?? new Date(instant.getTime());
}

/**
 * **When a planned visit stops being startable, and therefore counts as missed.**
 *
 * The later of its own window and the end of the rep's working day.
 *
 * It used to be the window alone, on both sides — the read model derived
 * `NOT_COMPLETED` at the window's end and a job wrote it a minute later. That
 * made the most ordinary thing that happens to a day, running late, produce the
 * worst record available: `start` was refused the minute after the planned end,
 * so a rep standing in the clinic could only reach it through a correction —
 * a typed justification and an `INFERRED` duration for a visit that was
 * perfectly measurable. Worse, one visit overrunning quietly converted every
 * later stop of the day into the same thing.
 *
 * Both the read model and the sweep call this, because the two disagreeing is
 * exactly the defect: the app offered a press the server refused.
 */
export function missedAfter(input: {
  occurrenceEndsAt: Date;
  timeZone: string;
  workdayEnd: string | null | undefined;
}): Date {
  const dayEnd = endOfWorkday(input.occurrenceEndsAt, input.timeZone, input.workdayEnd);
  return dayEnd > input.occurrenceEndsAt ? dayEnd : input.occurrenceEndsAt;
}
