export const DEFAULT_APPLICATION_TIMEZONE = 'America/Sao_Paulo'

type LocalDateParts = { year: number; month: number; day: number }

function datePartsAt(date: Date, timeZone: string): LocalDateParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value)

  return { year: value('year'), month: value('month'), day: value('day') }
}

function offsetMillisecondsAt(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value)
  const localAsUtc = Date.UTC(
    value('year'),
    value('month') - 1,
    value('day'),
    value('hour'),
    value('minute'),
    value('second')
  )

  return localAsUtc - date.getTime()
}

function localMidnightToUtc(parts: LocalDateParts, timeZone: string): Date {
  const localMidnightAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day)
  let result = new Date(
    localMidnightAsUtc - offsetMillisecondsAt(new Date(localMidnightAsUtc), timeZone)
  )
  // Resolve a potentially different offset at local midnight (DST-safe for supported IANA zones).
  result = new Date(localMidnightAsUtc - offsetMillisecondsAt(result, timeZone))
  return result
}

/**
 * Returns the half-open calendar week [Monday 00:00, following Monday 00:00)
 * in the supplied IANA timezone. The interval contains no rolling-duration semantics.
 */
export function getMondayToMondayWeek(
  now: Date,
  timeZone = DEFAULT_APPLICATION_TIMEZONE
): { start: Date; end: Date } {
  const local = datePartsAt(now, timeZone)
  const localAsUtc = new Date(Date.UTC(local.year, local.month - 1, local.day))
  const mondayOffset = (localAsUtc.getUTCDay() + 6) % 7
  localAsUtc.setUTCDate(localAsUtc.getUTCDate() - mondayOffset)

  const startParts = {
    year: localAsUtc.getUTCFullYear(),
    month: localAsUtc.getUTCMonth() + 1,
    day: localAsUtc.getUTCDate()
  }
  localAsUtc.setUTCDate(localAsUtc.getUTCDate() + 7)
  const endParts = {
    year: localAsUtc.getUTCFullYear(),
    month: localAsUtc.getUTCMonth() + 1,
    day: localAsUtc.getUTCDate()
  }

  return {
    start: localMidnightToUtc(startParts, timeZone),
    end: localMidnightToUtc(endParts, timeZone)
  }
}
