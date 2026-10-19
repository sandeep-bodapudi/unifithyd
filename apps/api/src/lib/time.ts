// Conversions between stored values and IST calendar days.
import { istDay, type Day } from '../domain/dates'

/** A @db.Date column value (UTC midnight) as a Day */
export const dbDay = (d: Date): Day => d.toISOString().slice(0, 10)

/** A Day as a value for a @db.Date column */
export const toDbDate = (day: Day): Date => new Date(`${day}T00:00:00Z`)

/** Today in IST */
export const todayIst = (now = new Date()): Day => istDay(now)

/** The UTC instant of HH:MM IST on an IST day */
export const istInstant = (day: Day, hhmm: string): Date => new Date(`${day}T${hhmm}:00+05:30`)

/** UTC instant when an IST day starts */
export const istDayStart = (day: Day): Date => istInstant(day, '00:00')

export { istDay }
