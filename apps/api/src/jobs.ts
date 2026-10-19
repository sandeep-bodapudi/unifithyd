// Scheduled work (MSG-5, BKG-5, BKG-6, CLS-5, PAY-15, PAY-16). Runs inside the API process
// every 5 minutes. Every job is idempotent: messages use dedupe keys, classes use unique keys.
import { prisma } from './db'
import { addDays } from './domain/dates'
import { fmtDay, fmtTime } from './lib/format'
import { notifyAdmins, sendMessage } from './lib/messages'
import { getSettings } from './lib/settings'
import { dbDay, istInstant, todayIst, toDbDate } from './lib/time'
import { profilePlans } from './services/memberships'
import { generateSeriesClasses } from './services/schedule'

const EVERY_MS = 5 * 60_000
let running = false

export function startJobs() {
  const tick = async () => {
    if (running) return
    running = true
    try {
      await runJobs()
    } catch (e) {
      console.error('[jobs] failed', e)
    } finally {
      running = false
    }
  }
  void tick()
  setInterval(() => void tick(), EVERY_MS)
}

export async function runJobs(now = new Date()) {
  await generateSeriesClasses()
  await sendReminders(now)
  await markNoShows(now)
  await expiryNotices(now)
  await dailySummary(now)
  await getSettings() // applies a pending UPI change once its delay has passed
}

const ownerOf = async (profileId: string) => (await prisma.guardian.findFirst({ where: { profileId }, orderBy: { createdAt: 'asc' } }))?.accountId

/** BKG-5 and MSG-6: reminder before class; early classes are reminded at 8 pm the night before */
async function sendReminders(now: Date) {
  const s = await getSettings()
  const horizon = new Date(now.getTime() + 14 * 3600_000)
  const classes = await prisma.class.findMany({ where: { status: 'SCHEDULED', startsAt: { gt: now, lte: horizon } }, include: { bookings: { where: { status: { in: ['BOOKED', 'TRIAL'] } }, include: { profile: true } } } })
  for (const c of classes) {
    const startHourIst = Number(c.startsAt.toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }))
    const early = startHourIst < 9
    const sendAt = early ? istInstant(addDays(todayIst(c.startsAt), -1), '20:00') : new Date(c.startsAt.getTime() - s.reminderHoursBefore * 3600_000)
    if (now < sendAt) continue
    for (const b of c.bookings) {
      if (b.createdAt > sendAt) continue // booked inside the window: they already know
      const acc = await ownerOf(b.profileId)
      if (!acc) continue
      await sendMessage({
        accountId: acc,
        template: 'reminder',
        data: { profile: b.profile.name, title: c.title, time: fmtTime(c.startsAt), where: c.mode === 'OFFLINE' ? `Location: ${c.locationOrLink}` : 'The join link is in the app from 30 minutes before.' },
        dedupeKey: `reminder:${b.id}`,
      })
    }
  }
}

/** BKG-6: bookings without a check-in become no-shows once the class's IST day is over */
async function markNoShows(now: Date) {
  const todayStart = istInstant(todayIst(now), '00:00')
  const past = await prisma.class.findMany({ where: { status: 'SCHEDULED', startsAt: { lt: todayStart } }, select: { id: true } })
  for (const c of past) {
    await prisma.booking.updateMany({ where: { classId: c.id, status: 'BOOKED' }, data: { status: 'NO_SHOW' } })
    await prisma.class.update({ where: { id: c.id }, data: { status: 'COMPLETED' } })
  }
}

/** PAY-15: 3 days before the end, on the last day, and on the first Due day */
async function expiryNotices(now: Date) {
  const s = await getSettings()
  const today = todayIst(now)
  const ends = await prisma.membership.findMany({
    where: { status: { not: 'CANCELLED' }, endDate: { gte: toDbDate(addDays(today, -(s.graceDays + 1))), lte: toDbDate(addDays(today, 3)) } },
    include: { profile: true, plan: true },
  })
  for (const m of ends) {
    const plans = await profilePlans(m.profileId, s.graceDays, today)
    const plan = plans.find((p) => p.planId === m.planId)
    if (!plan || plan.end !== dbDay(m.endDate)) continue // a later renewal exists
    const acc = await ownerOf(m.profileId)
    if (!acc) continue
    const data = { profile: m.profile.name, plan: m.plan.name, until: fmtDay(plan.end) }
    if (addDays(today, 3) === plan.end) await sendMessage({ accountId: acc, template: 'expiry_soon', data, dedupeKey: `exp3:${m.id}` })
    if (today === plan.end) await sendMessage({ accountId: acc, template: 'expiry_today', data, dedupeKey: `exp0:${m.id}` })
    if (today === addDays(plan.end, s.graceDays + 1)) await sendMessage({ accountId: acc, template: 'now_due', data, dedupeKey: `due:${m.id}` })
  }
}

/** PAY-16: 9 am IST summary for admins */
async function dailySummary(now: Date) {
  const today = todayIst(now)
  if (now < istInstant(today, '09:00')) return
  const s = await getSettings()
  const pending = await prisma.payment.count({ where: { status: 'PENDING' } })
  const ending = await prisma.membership.findMany({ where: { status: { not: 'CANCELLED' }, endDate: { gte: toDbDate(addDays(today, -(s.graceDays + 1))), lte: toDbDate(today) } }, select: { profileId: true } })
  let due = 0
  let grace = 0
  for (const id of new Set(ending.map((e) => e.profileId))) {
    const plans = await profilePlans(id, s.graceDays, today)
    if (plans.some((p) => p.status === 'GRACE')) grace++
    else if (plans.some((p) => p.status === 'DUE' && addDays(p.end, s.graceDays + 1) === today)) due++
  }
  const leads = await prisma.lead.count({ where: { status: { in: ['NEW', 'TRIAL_BOOKED', 'ATTENDED'] }, OR: [{ followUpOn: null }, { followUpOn: { lte: toDbDate(today) } }] } })
  await notifyAdmins('admin_daily', { date: fmtDay(today), pending, due, grace, leads }, `daily:${today}`)
}
