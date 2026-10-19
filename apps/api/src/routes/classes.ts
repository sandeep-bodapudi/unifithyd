// Member-facing timetable and bookings (CLS-3, CLS-4, BKG-1 to BKG-8)
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db'
import { assertProfileAccess, ownProfileIds, requireAuth } from '../lib/auth'
import { badRequest, forbidden, h, HttpError, parse } from '../lib/http'
import { getSettings } from '../lib/settings'
import { profilePlans } from '../services/memberships'
import { bookClass, cancelBooking } from '../services/schedule'

export const classesRouter = Router()
classesRouter.use(requireAuth)

const LINK_WINDOW_MS = 30 * 60_000

classesRouter.get(
  '/',
  h(async (req, res) => {
    const q = parse(z.object({ days: z.coerce.number().int().min(1).max(28).default(14) }), req.query)
    const profileIds = await ownProfileIds(req.account!.id)
    const now = new Date()
    const classes = await prisma.class.findMany({
      where: { status: 'SCHEDULED', startsAt: { gte: new Date(now.getTime() - 60 * 60_000), lt: new Date(now.getTime() + q.days * 86_400_000) } },
      orderBy: { startsAt: 'asc' },
      include: {
        program: { select: { id: true, name: true, audience: true } },
        coach: { select: { name: true } },
        bookings: { where: { status: { in: ['BOOKED', 'TRIAL', 'ATTENDED'] } }, select: { id: true, profileId: true, status: true } },
        waitlist: { where: { profileId: { in: profileIds } }, select: { profileId: true } },
      },
    })
    res.json({
      classes: classes.map((c) => {
        const mine = c.bookings.filter((b) => profileIds.includes(b.profileId))
        const booked = c.bookings.length
        const showLink = c.mode === 'ONLINE' && mine.length > 0 && c.startsAt.getTime() - now.getTime() <= LINK_WINDOW_MS
        return {
          id: c.id,
          title: c.title,
          program: c.program,
          coach: c.coach.name,
          startsAt: c.startsAt.toISOString(),
          durationMin: c.durationMin,
          mode: c.mode,
          location: c.mode === 'OFFLINE' ? c.locationOrLink : null,
          link: showLink ? c.locationOrLink : null,
          capacity: c.capacity,
          spotsLeft: Math.max(0, c.capacity - booked),
          myBookings: mine.map((b) => ({ id: b.id, profileId: b.profileId, status: b.status })),
          myWaitlist: c.waitlist.map((w) => w.profileId),
        }
      }),
    })
  }),
)

// Book one or several profiles into a class (BKG-8)
classesRouter.post(
  '/:classId/book',
  h(async (req, res) => {
    const { profileIds } = parse(z.object({ profileIds: z.array(z.string()).min(1).max(6) }), req.body)
    const results = []
    for (const pid of profileIds) {
      await assertProfileAccess(req, pid)
      try {
        const b = await bookClass(pid, String(req.params.classId))
        results.push({ profileId: pid, ok: true, bookingId: b.id })
      } catch (e) {
        if (e instanceof HttpError) results.push({ profileId: pid, ok: false, code: e.code, message: e.message })
        else throw e
      }
    }
    res.json({ results })
  }),
)

classesRouter.post(
  '/bookings/:bookingId/cancel',
  h(async (req, res) => {
    const b = await prisma.booking.findUnique({ where: { id: String(req.params.bookingId) } })
    if (!b) throw badRequest('Booking not found')
    await assertProfileAccess(req, b.profileId)
    res.json(await cancelBooking(b.id))
  }),
)

classesRouter.post(
  '/:classId/waitlist',
  h(async (req, res) => {
    const { profileId } = parse(z.object({ profileId: z.string() }), req.body)
    await assertProfileAccess(req, profileId)
    const cls = await prisma.class.findUnique({ where: { id: String(req.params.classId) } })
    if (!cls || cls.status !== 'SCHEDULED') throw badRequest('Class not found')
    if (cls.startsAt.getTime() - Date.now() < 2 * 3600_000) throw badRequest('The waitlist closes 2 hours before the class')
    await prisma.waitlist.upsert({ where: { classId_profileId: { classId: cls.id, profileId } }, update: {}, create: { classId: cls.id, profileId } })
    res.json({ ok: true })
  }),
)

classesRouter.delete(
  '/:classId/waitlist/:profileId',
  h(async (req, res) => {
    await assertProfileAccess(req, String(req.params.profileId))
    await prisma.waitlist.deleteMany({ where: { classId: String(req.params.classId), profileId: String(req.params.profileId) } })
    res.json({ ok: true })
  }),
)

// The member's own plans, credits and history per profile (FIT-1, PAY-5)
classesRouter.get(
  '/profiles/:profileId/summary',
  h(async (req, res) => {
    const profileId = String(req.params.profileId)
    await assertProfileAccess(req, profileId)
    const settings = await getSettings()
    const [plans, attended, upcoming, history] = await Promise.all([
      profilePlans(profileId, settings.graceDays),
      prisma.attendance.findMany({ where: { profileId }, select: { at: true }, orderBy: { at: 'desc' } }),
      prisma.booking.count({ where: { profileId, status: 'BOOKED', class: { startsAt: { gte: new Date() } } } }),
      prisma.booking.findMany({ where: { profileId }, orderBy: { class: { startsAt: 'desc' } }, take: 20, include: { class: { select: { title: true, startsAt: true, mode: true } } } }),
    ])
    const closures = await prisma.closure.findMany()
    res.json({ plans, upcoming, ...streakStats(attended.map((a) => a.at), closures), history: history.map((b) => ({ id: b.id, status: b.status, title: b.class.title, startsAt: b.class.startsAt, mode: b.class.mode })) })
  }),
)

/** Totals and a weekly streak: a week counts if at least one class was attended; fully closed weeks do not break it (FIT-1) */
function streakStats(dates: Date[], closures: { fromDate: Date; toDate: Date }[]) {
  const ist = (d: Date) => new Date(d.getTime() + 330 * 60_000)
  const weekKey = (d: Date) => {
    const x = ist(d)
    const day = (x.getUTCDay() + 6) % 7
    const monday = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate() - day))
    return monday.toISOString().slice(0, 10)
  }
  const weeks = new Set(dates.map(weekKey))
  const now = new Date()
  const monthStart = ist(now).toISOString().slice(0, 7)
  let streak = 0
  const cursor = new Date(`${weekKey(now)}T00:00:00Z`)
  if (!weeks.has(cursor.toISOString().slice(0, 10))) cursor.setUTCDate(cursor.getUTCDate() - 7) // this week not yet attended doesn't break it
  for (let i = 0; i < 520; i++) {
    const key = cursor.toISOString().slice(0, 10)
    const sunday = new Date(cursor.getTime() + 6 * 86_400_000)
    const closedWeek = closures.some((c) => c.fromDate <= cursor && c.toDate >= sunday)
    if (weeks.has(key)) streak++
    else if (!closedWeek) break
    cursor.setUTCDate(cursor.getUTCDate() - 7)
  }
  return { totalAttended: dates.length, thisMonth: dates.filter((d) => ist(d).toISOString().slice(0, 7) === monthStart).length, streakWeeks: streak }
}

// Weight log (FIT-2): adults only, never visible to coaches
classesRouter.get(
  '/profiles/:profileId/weights',
  h(async (req, res) => {
    const profileId = String(req.params.profileId)
    await assertProfileAccess(req, profileId)
    const rows = await prisma.weightLog.findMany({ where: { profileId }, orderBy: { date: 'asc' }, take: 60 })
    res.json({ weights: rows.map((r) => ({ date: r.date.toISOString().slice(0, 10), kg: Number(r.weightKg) })) })
  }),
)

classesRouter.post(
  '/profiles/:profileId/weights',
  h(async (req, res) => {
    const profileId = String(req.params.profileId)
    await assertProfileAccess(req, profileId)
    const p = await prisma.profile.findUniqueOrThrow({ where: { id: profileId } })
    if (p.kind === 'CHILD') throw forbidden('Weight tracking is not available for children')
    const d = parse(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), kg: z.number().min(15).max(300) }), req.body)
    const date = new Date(`${d.date}T00:00:00Z`)
    await prisma.weightLog.upsert({ where: { profileId_date: { profileId, date } }, update: { weightKg: d.kg }, create: { profileId, date, weightKg: d.kg } })
    res.json({ ok: true })
  }),
)
