import { ValidationError } from "../../../../shared/errors";

/** A clock a few minutes ahead is skew, not evidence about the future. */
export const CLIENT_CLOCK_SKEW_MINUTES = 5;

/**
 * How far back a client stamp may reach. A queue older than this is not a
 * flaky-signal problem any more, and §15.6.6-4 is explicit that the choice is
 * between accepting the client's stamp and refusing outright — never recording
 * a time nobody witnessed.
 */
export const CLIENT_STAMP_MAX_AGE_HOURS = 24;

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/**
 * When something actually happened, according to the device it happened on.
 *
 * The server used to stamp `now` at receipt (§15.6.6-4). A start queued in a
 * clinic with no signal was therefore stamped when connectivity returned —
 * minutes or hours late — and every duration computed from it was fiction. That
 * makes offline capture a *correctness* dependency of outcome capture rather
 * than a convenience: the client has to say when, and the server has to be
 * willing to believe it within bounds.
 *
 * Absent is still valid and still means now, so a client that has not been
 * taught to stamp behaves exactly as before.
 */
export function resolveClientInstant(input: {
  claimed?: string | undefined;
  now: Date;
  field: string;
}): Date {
  if (input.claimed === undefined) return input.now;

  const claimed = new Date(input.claimed);
  if (!Number.isFinite(claimed.getTime())) {
    throw new ValidationError([{ field: input.field, message: `${input.field} is not a valid instant` }]);
  }

  if (claimed.getTime() > input.now.getTime() + CLIENT_CLOCK_SKEW_MINUTES * MINUTE_MS) {
    throw new ValidationError([{ field: input.field, message: `${input.field} cannot be in the future` }]);
  }

  if (claimed.getTime() < input.now.getTime() - CLIENT_STAMP_MAX_AGE_HOURS * HOUR_MS) {
    throw new ValidationError([{ field: input.field, message: `${input.field} is more than ${CLIENT_STAMP_MAX_AGE_HOURS}h old` }]);
  }

  // Within skew but ahead: the device is a little fast, and a visit that starts
  // in the future would fail the ends-after-starts check on the way out.
  return claimed.getTime() > input.now.getTime() ? input.now : claimed;
}
