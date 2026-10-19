// Membership and entitlement rules: PRD v3.0 section 7.
// Pure functions only, so every rule is unit-tested without a database.
import { addDays, addMonthsClamped, daysInMonth, diffDays, parseDay, weekStart, type Day } from './dates'

/** Last day of a period that starts on `start` and runs `months` cycles (7.4). */
export function periodEnd(start: Day, months: number): Day {
  const { d } = parseDay(start)
  const target = addMonthsClamped(start, months)
  const t = parseDay(target)
  // Start on the 31st into a 30-day month (or Feb): the period ends on that month's last day
  if (d > daysInMonth(t.y, t.m)) return target
  return addDays(target, -1)
}

/** Where a new paid period starts (7.4). */
export function renewalStart(opts: { previousEnd: Day | null; paidOn: Day; graceDays: number }): Day {
  const { previousEnd, paidOn, graceDays } = opts
  if (!previousEnd) return paidOn
  const graceEnd = addDays(previousEnd, graceDays)
  return paidOn <= graceEnd ? addDays(previousEnd, 1) : paidOn
}

export type Period = {
  id: string
  start: Day
  months: number
  freezeDays: number
  end: Day
}

/**
 * Rebuilds a chain of periods for one profile and plan so there are no gaps,
 * after one period is cancelled (reversal or refund) or a freeze changes an end date (7.5).
 * `anchor` is the start of the first period in the chain.
 */
export function rechain(periods: Omit<Period, 'end'>[], anchor: Day): Period[] {
  const out: Period[] = []
  let start = anchor
  for (const p of periods) {
    const end = addDays(periodEnd(start, p.months), p.freezeDays)
    out.push({ ...p, start, end })
    start = addDays(end, 1)
  }
  return out
}

/** Cancel one period in a chain and close the gap (7.5, example 6). */
export function cancelInChain(chain: Period[], cancelId: string): Period[] {
  if (chain.length === 0) return chain
  const anchor = chain[0].start
  return rechain(
    chain.filter((p) => p.id !== cancelId),
    anchor,
  )
}

export type DisplayStatus = 'SCHEDULED' | 'ACTIVE' | 'GRACE' | 'DUE' | 'FROZEN'

export type Freeze = { start: Day; days: number }

/** Status of a profile's plan on a given IST day (7.3). `chain` must be sorted and uncancelled. */
export function statusOn(chain: Period[], freezes: Freeze[], today: Day, graceDays: number): DisplayStatus {
  if (chain.length === 0) return 'DUE'
  for (const f of freezes) {
    if (today >= f.start && today <= addDays(f.start, f.days - 1)) return 'FROZEN'
  }
  if (today < chain[0].start) return 'SCHEDULED'
  const last = chain[chain.length - 1]
  if (today <= last.end) return 'ACTIVE'
  if (today <= addDays(last.end, graceDays)) return 'GRACE'
  return 'DUE'
}

/** First and last day of the cycle within `period` that contains `day`. */
export function cycleOf(periodStart: Day, day: Day): { start: Day; end: Day } {
  let start = periodStart
  // cycles are at most 12 per period; walk forward month by month
  for (let i = 0; i < 400; i++) {
    const end = periodEnd(start, 1)
    if (day <= end) return { start, end }
    start = addDays(end, 1)
  }
  throw new Error('cycleOf: day too far from period start')
}

export type PlanRule = {
  programIds: string[]
  creditsPerCycle: number | null
  weeklyCap: number | null
}

export type BookingCheck = {
  classDay: Day
  classProgramId: string
  classProgramName: string
  plan: PlanRule
  periodStart: Day
  periodEnd: Day
  graceDays: number
  /** Booked or late-cancelled classes (credit used) for this plan, with their IST day */
  usedDays: Day[]
  /** Unexpired make-up credits available */
  makeupCredits: number
}

export type BookingResult = { ok: true; usesMakeup: boolean } | { ok: false; code: string; message: string }

/** Can this profile book this class under this plan? (7.2, BKG-1) */
export function checkBooking(c: BookingCheck): BookingResult {
  if (!c.plan.programIds.includes(c.classProgramId)) {
    return { ok: false, code: 'NOT_IN_PLAN', message: `Your plan does not include ${c.classProgramName}` }
  }
  const lastBookable = addDays(c.periodEnd, c.graceDays)
  if (c.classDay < c.periodStart || c.classDay > lastBookable) {
    return { ok: false, code: 'OUTSIDE_MEMBERSHIP', message: 'This class is outside your membership dates' }
  }
  if (c.plan.weeklyCap !== null) {
    const ws = weekStart(c.classDay)
    const inWeek = c.usedDays.filter((d) => weekStart(d) === ws).length
    if (inWeek >= c.plan.weeklyCap) {
      return { ok: false, code: 'WEEKLY_LIMIT', message: `Weekly limit of ${c.plan.weeklyCap} reached` }
    }
  }
  if (c.plan.creditsPerCycle !== null) {
    const cyc = cycleOf(c.periodStart, c.classDay)
    const inCycle = c.usedDays.filter((d) => d >= cyc.start && d <= cyc.end).length
    if (inCycle >= c.plan.creditsPerCycle) {
      if (c.makeupCredits > 0) return { ok: true, usesMakeup: true }
      return { ok: false, code: 'NO_CREDITS', message: 'No classes left this cycle' }
    }
  }
  return { ok: true, usesMakeup: false }
}

/** Is the credit returned when cancelling now? (BKG-3) */
export function cancelReturnsCredit(classStartsAt: Date, now: Date, cutoffHours: number): boolean {
  return classStartsAt.getTime() - now.getTime() >= cutoffHours * 3_600_000
}

/** Days between two IST days, exposed for freeze maths in services */
export { diffDays }
