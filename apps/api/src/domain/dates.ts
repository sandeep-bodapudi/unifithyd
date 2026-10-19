// Calendar-day helpers. A "day" is an IST calendar date written as YYYY-MM-DD.
// Using plain strings avoids time-zone drift: no Date arithmetic on local time.

export type Day = string // YYYY-MM-DD

const pad = (n: number) => String(n).padStart(2, '0')

export function parseDay(d: Day): { y: number; m: number; d: number } {
  const [y, m, dd] = d.split('-').map(Number)
  return { y, m, d: dd }
}

export function toDay(y: number, m: number, d: number): Day {
  // normalise via UTC so month/day overflow rolls correctly
  const dt = new Date(Date.UTC(y, m - 1, d))
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}

export function addDays(day: Day, n: number): Day {
  const { y, m, d } = parseDay(day)
  return toDay(y, m, d + n)
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/** Same day-of-month `months` later, clamped to the last day of a short month. */
export function addMonthsClamped(day: Day, months: number): Day {
  const { y, m, d } = parseDay(day)
  const total = m - 1 + months
  const ty = y + Math.floor(total / 12)
  const tm = (((total % 12) + 12) % 12) + 1
  return toDay(ty, tm, Math.min(d, daysInMonth(ty, tm)))
}

export function diffDays(a: Day, b: Day): number {
  const A = parseDay(a)
  const B = parseDay(b)
  return Math.round((Date.UTC(B.y, B.m - 1, B.d) - Date.UTC(A.y, A.m - 1, A.d)) / 86_400_000)
}

/** ISO weekday, Monday = 1 ... Sunday = 7 */
export function weekday(day: Day): number {
  const { y, m, d } = parseDay(day)
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return w === 0 ? 7 : w
}

/** Monday of the week (Monday to Sunday) containing `day` */
export function weekStart(day: Day): Day {
  return addDays(day, 1 - weekday(day))
}

/** The IST calendar day of an instant */
export function istDay(instant: Date): Day {
  const ist = new Date(instant.getTime() + 330 * 60_000)
  return `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())}`
}

export const maxDay = (a: Day, b: Day) => (a > b ? a : b)
