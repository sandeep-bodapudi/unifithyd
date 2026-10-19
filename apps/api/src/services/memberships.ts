// Database side of the membership rules (PRD section 7). Logic lives in domain/membership.ts.
import { prisma } from '../db'
import { addDays, weekStart, type Day } from '../domain/dates'
import { checkBooking, cycleOf, periodEnd, rechain, renewalStart, statusOn, type DisplayStatus, type Period } from '../domain/membership'
import type { Prisma } from '../generated/prisma/client'
import { dbDay, istDay, toDbDate } from '../lib/time'

type Tx = Prisma.TransactionClient | typeof prisma

const COUNTED = ['BOOKED', 'LATE_CANCELLED', 'ATTENDED', 'NO_SHOW'] as const

type Row = Prisma.MembershipGetPayload<{ include: { freezes: true } }>

const freezeDays = (m: Row) => m.freezes.reduce((s, f) => s + f.days, 0)

/** Contiguous runs of non-cancelled memberships for one profile and plan, oldest first */
async function runs(db: Tx, profileId: string, planId: string): Promise<Row[][]> {
  const rows = await db.membership.findMany({ where: { profileId, planId, status: { not: 'CANCELLED' } }, include: { freezes: true }, orderBy: { startDate: 'asc' } })
  const out: Row[][] = []
  for (const r of rows) {
    const last = out.at(-1)?.at(-1)
    if (last && dbDay(r.startDate) === addDays(dbDay(last.endDate), 1)) out.at(-1)!.push(r)
    else out.push([r])
  }
  return out
}

const toPeriod = (m: Row, months: number): Period => ({ id: m.id, start: dbDay(m.startDate), end: dbDay(m.endDate), months, freezeDays: freezeDays(m) })

/**
 * Re-chains the run that starts at `anchor` after a cancellation or freeze (7.5).
 * `rows` are the run's remaining (non-cancelled) memberships in order.
 */
export async function rechainRun(db: Tx, rows: Row[], anchor: Day, months: number) {
  const chain = rechain(rows.map((r) => ({ id: r.id, start: '', months, freezeDays: freezeDays(r) })), anchor)
  for (const p of chain) await db.membership.update({ where: { id: p.id }, data: { startDate: toDbDate(p.start), endDate: toDbDate(p.end) } })
  return chain
}

/** The run containing a membership, and the day that run starts */
export async function runContaining(db: Tx, membershipId: string) {
  const m = await db.membership.findUniqueOrThrow({ where: { id: membershipId }, include: { plan: true } })
  const run = (await runs(db, m.profileId, m.planId)).find((r) => r.some((x) => x.id === membershipId)) ?? []
  return { run, anchor: run.length ? dbDay(run[0].startDate) : dbDay(m.startDate), months: m.plan.cycleMonths }
}

/** Dates for a new paid period (7.4) */
export async function nextPeriod(db: Tx, profileId: string, planId: string, paidOn: Day, graceDays: number) {
  const plan = await db.plan.findUniqueOrThrow({ where: { id: planId } })
  const all = await runs(db, profileId, planId)
  const lastRun = all.at(-1)
  const previousEnd = lastRun ? dbDay(lastRun.at(-1)!.endDate) : null
  const start = renewalStart({ previousEnd, paidOn, graceDays })
  return { start, end: periodEnd(start, plan.cycleMonths) }
}

export type PlanStatus = {
  planId: string
  planName: string
  shortCode: string
  pricePaise: number
  status: DisplayStatus
  start: Day
  end: Day
  creditsLeft: number | null
  weekLeft: number | null
  makeupCredits: number
}

/** Current status per plan for one profile (7.3), with credits left (7.2) */
export async function profilePlans(profileId: string, graceDays: number, today = istDay(new Date())): Promise<PlanStatus[]> {
  const plans = await prisma.plan.findMany({ where: { memberships: { some: { profileId } } } })
  const out: PlanStatus[] = []
  const makeup = await makeupAvailable(prisma, profileId, today)
  for (const plan of plans) {
    const all = await runs(prisma, profileId, plan.id)
    // the run that covers today (or the next scheduled), else the latest
    const run = all.find((r) => today <= addDays(dbDay(r.at(-1)!.endDate), graceDays)) ?? all.at(-1)
    if (!run) continue
    const chain = run.map((m) => toPeriod(m, plan.cycleMonths))
    const freezes = run.flatMap((m) => m.freezes.map((f) => ({ start: dbDay(f.startDate), days: f.days })))
    const status = statusOn(chain, freezes, today, graceDays)
    let creditsLeft: number | null = null
    let weekLeft: number | null = null
    const current = run.find((m) => today >= dbDay(m.startDate) && today <= dbDay(m.endDate)) ?? run[0]
    if (plan.creditsPerCycle !== null || plan.weeklyCap !== null) {
      const used = await usedDays(prisma, profileId, plan.id)
      const refDay = today < dbDay(current.startDate) ? dbDay(current.startDate) : today
      if (plan.creditsPerCycle !== null) {
        const cyc = cycleOf(dbDay(current.startDate), refDay > dbDay(current.endDate) ? dbDay(current.endDate) : refDay)
        creditsLeft = Math.max(0, plan.creditsPerCycle - used.filter((d) => d >= cyc.start && d <= cyc.end).length)
      }
      if (plan.weeklyCap !== null) {
        const ws = weekStart(refDay)
        weekLeft = Math.max(0, plan.weeklyCap - used.filter((d) => weekStart(d) === ws).length)
      }
    }
    out.push({
      planId: plan.id,
      planName: plan.name,
      shortCode: plan.shortCode,
      pricePaise: plan.pricePaise,
      status,
      start: dbDay(run[0].startDate),
      end: dbDay(run.at(-1)!.endDate),
      creditsLeft,
      weekLeft,
      makeupCredits: makeup,
    })
  }
  return out
}

/** IST days of classes that used a credit under a plan */
async function usedDays(db: Tx, profileId: string, planId: string): Promise<Day[]> {
  const b = await db.booking.findMany({
    where: { profileId, creditUsed: true, status: { in: [...COUNTED] }, membership: { planId } },
    select: { class: { select: { startsAt: true } } },
  })
  return b.map((x) => istDay(x.class.startsAt))
}

/** Unexpired make-up credits minus those already used (BKG-9) */
export async function makeupAvailable(db: Tx, profileId: string, today: Day): Promise<number> {
  const granted = await db.creditAdjustment.aggregate({ where: { profileId, kind: 'MAKEUP', OR: [{ expiresOn: null }, { expiresOn: { gte: toDbDate(today) } }] }, _sum: { delta: true } })
  const used = await db.booking.count({ where: { profileId, makeupUsed: true, status: { in: [...COUNTED] } } })
  return Math.max(0, (granted._sum.delta ?? 0) - used)
}

export type Entitlement = { ok: true; membershipId: string; usesMakeup: boolean } | { ok: false; code: string; message: string }

/** Finds a membership that lets this profile book this class (7.2) */
export async function entitlementFor(db: Tx, profileId: string, cls: { startsAt: Date; programId: string; programName: string }, graceDays: number): Promise<Entitlement> {
  const classDay = istDay(cls.startsAt)
  const plans = await db.plan.findMany({ where: { memberships: { some: { profileId, status: { not: 'CANCELLED' } } } }, include: { programs: true } })
  if (plans.length === 0) return { ok: false, code: 'NO_MEMBERSHIP', message: 'You need an active plan to book. Choose one on the Pay tab.' }
  let firstRefusal: Entitlement | null = null
  for (const plan of plans) {
    for (const run of await runs(db, profileId, plan.id)) {
      const m = run.find((x) => classDay >= dbDay(x.startDate) && classDay <= dbDay(x.endDate)) ?? (classDay > dbDay(run.at(-1)!.endDate) ? run.at(-1) : undefined)
      if (!m) continue
      const frozen = m.freezes.some((f) => classDay >= dbDay(f.startDate) && classDay <= addDays(dbDay(f.startDate), f.days - 1))
      if (frozen) {
        firstRefusal ??= { ok: false, code: 'FROZEN', message: 'Your membership is paused on this date' }
        continue
      }
      const r = checkBooking({
        classDay,
        classProgramId: cls.programId,
        classProgramName: cls.programName,
        plan: { programIds: plan.programs.map((p) => p.programId), creditsPerCycle: plan.creditsPerCycle, weeklyCap: plan.weeklyCap },
        periodStart: dbDay(m.startDate),
        periodEnd: dbDay(m.endDate),
        graceDays: m === run.at(-1) ? graceDays : 0,
        usedDays: await usedDays(db, profileId, plan.id),
        makeupCredits: await makeupAvailable(db, profileId, classDay),
      })
      if (r.ok) return { ok: true, membershipId: m.id, usesMakeup: r.usesMakeup }
      firstRefusal ??= r
    }
  }
  return firstRefusal ?? { ok: false, code: 'OUTSIDE_MEMBERSHIP', message: 'Your plan does not cover this date. Renew on the Pay tab.' }
}
