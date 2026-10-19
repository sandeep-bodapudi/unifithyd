// Coach and admin: classes, series, rosters, closures, class messages (CLS-1 to CLS-9, COA-1 to COA-4)
import { Router, type Request } from 'express'
import { z } from 'zod'
import { prisma } from '../db'
import { audit } from '../lib/audit'
import { isAdmin, requireAdmin, requireStaff } from '../lib/auth'
import { classCode, hashPassword, verifyPassword } from '../lib/crypto'
import { badRequest, forbidden, h, notFound, parse } from '../lib/http'
import { sendMessage } from '../lib/messages'
import { getSettings } from '../lib/settings'
import { istDay, istInstant, todayIst, toDbDate, dbDay } from '../lib/time'
import { generateSeriesClasses, notifyClassChange, studioCancelClass } from '../services/schedule'
import { profilePlans } from '../services/memberships'
import { memberCode } from '../domain/upi'

export const staffRouter = Router()
staffRouter.use(requireStaff)

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a 24-hour time like 18:00')

/** Coaches manage their own programs and classes; admins manage all (6.2) */
async function canManage(req: Request, programId: string, coachId?: string) {
  const acc = req.account!
  if (isAdmin(acc.roles)) return
  if (coachId === acc.id) return
  const own = await prisma.program.count({ where: { id: programId, coaches: { some: { id: acc.id } } } })
  if (!own) throw forbidden('You can only manage classes in your own programs')
}

async function classForStaff(req: Request, id: string) {
  const cls = await prisma.class.findUnique({ where: { id }, include: { program: true } })
  if (!cls) throw notFound('Class not found')
  await canManage(req, cls.programId, cls.coachId)
  return cls
}

staffRouter.get(
  '/meta',
  h(async (_req, res) => {
    const [programs, coaches] = await Promise.all([
      prisma.program.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
      prisma.account.findMany({ where: { disabled: false, roles: { some: { role: { in: ['COACH', 'ADMIN', 'OWNER'] } } } }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    ])
    res.json({ programs, coaches })
  }),
)

// Classes in a date range; coaches see their own programs' classes (COA-1)
staffRouter.get(
  '/classes',
  h(async (req, res) => {
    const q = parse(z.object({ from: day.optional(), days: z.coerce.number().int().min(1).max(31).default(1) }), req.query)
    const from = q.from ?? todayIst()
    const acc = req.account!
    const scope = isAdmin(acc.roles) ? {} : { OR: [{ coachId: acc.id }, { program: { coaches: { some: { id: acc.id } } } }] }
    const classes = await prisma.class.findMany({
      where: { startsAt: { gte: istInstant(from, '00:00'), lt: new Date(istInstant(from, '00:00').getTime() + q.days * 86_400_000) }, ...scope },
      orderBy: { startsAt: 'asc' },
      include: { program: { select: { name: true } }, coach: { select: { name: true } }, _count: { select: { bookings: { where: { status: { in: ['BOOKED', 'TRIAL', 'ATTENDED', 'NO_SHOW'] } } }, attendance: true } } },
    })
    res.json({
      classes: classes.map((c) => ({
        id: c.id, title: c.title, program: c.program.name, programId: c.programId, coach: c.coach.name, coachId: c.coachId, seriesId: c.seriesId,
        startsAt: c.startsAt, durationMin: c.durationMin, mode: c.mode, locationOrLink: c.locationOrLink, capacity: c.capacity, status: c.status, notes: c.notes,
        booked: c._count.bookings, checkedIn: c._count.attendance,
      })),
    })
  }),
)

const classInput = z.object({
  programId: z.string(),
  coachId: z.string(),
  title: z.string().trim().min(2).max(80),
  day,
  time: hhmm,
  durationMin: z.number().int().min(15).max(240),
  mode: z.enum(['ONLINE', 'OFFLINE']),
  locationOrLink: z.string().trim().min(2).max(500),
  capacity: z.number().int().min(1).max(200),
  notes: z.string().max(1000).optional(),
})

const checkLocation = (mode: 'ONLINE' | 'OFFLINE', v: string) => {
  if (mode === 'ONLINE' && !/^https:\/\/\S+$/.test(v)) throw forbidden('Online classes need a meeting link starting with https://')
}

staffRouter.post(
  '/classes',
  h(async (req, res) => {
    const d = parse(classInput, req.body)
    await canManage(req, d.programId, d.coachId)
    checkLocation(d.mode, d.locationOrLink)
    const cls = await prisma.class.create({
      data: { programId: d.programId, coachId: d.coachId, title: d.title, startsAt: istInstant(d.day, d.time), durationMin: d.durationMin, mode: d.mode, locationOrLink: d.locationOrLink, capacity: d.capacity, notes: d.notes },
    })
    await audit(prisma, req, 'class.created', 'Class', cls.id, null, d)
    res.status(201).json({ id: cls.id })
  }),
)

staffRouter.patch(
  '/classes/:id',
  h(async (req, res) => {
    const cls = await classForStaff(req, String(req.params.id))
    const d = parse(classInput.partial(), req.body)
    const startsAt = d.day || d.time ? istInstant(d.day ?? istDay(cls.startsAt), d.time ?? cls.startsAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })) : cls.startsAt
    const mode = d.mode ?? cls.mode
    if (d.locationOrLink || d.mode) checkLocation(mode, d.locationOrLink ?? cls.locationOrLink)
    if (d.programId) await canManage(req, d.programId, d.coachId)
    const updated = await prisma.class.update({
      where: { id: cls.id },
      data: { title: d.title, programId: d.programId, coachId: d.coachId, startsAt, durationMin: d.durationMin, mode: d.mode, locationOrLink: d.locationOrLink, capacity: d.capacity, notes: d.notes },
    })
    const changes: string[] = []
    const moved = Math.abs(updated.startsAt.getTime() - cls.startsAt.getTime())
    if (moved > 0) changes.push(`now ${updated.startsAt.toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })}`)
    if (updated.mode !== cls.mode) changes.push(updated.mode === 'ONLINE' ? 'now online' : 'now at the studio')
    if (updated.locationOrLink !== cls.locationOrLink && updated.mode === 'OFFLINE') changes.push(`new location: ${updated.locationOrLink}`)
    if (updated.coachId !== cls.coachId) changes.push('new coach')
    if (changes.length) await notifyClassChange(cls.id, changes.join(', '), moved > 3600_000 || updated.mode !== cls.mode)
    await audit(prisma, req, 'class.updated', 'Class', cls.id, cls, updated)
    res.json({ ok: true })
  }),
)

staffRouter.post(
  '/classes/:id/cancel',
  h(async (req, res) => {
    const cls = await classForStaff(req, String(req.params.id))
    const { reason } = parse(z.object({ reason: z.string().trim().min(3).max(300) }), req.body)
    const n = await studioCancelClass(cls.id, reason)
    await audit(prisma, req, 'class.cancelled', 'Class', cls.id, null, { reason, notified: n })
    res.json({ ok: true, notified: n })
  }),
)

// Roster with status, credits and Paid/Due (COA-4: no amounts, no phone numbers, no weights)
staffRouter.get(
  '/classes/:id/roster',
  h(async (req, res) => {
    const cls = await classForStaff(req, String(req.params.id))
    const settings = await getSettings()
    const bookings = await prisma.booking.findMany({
      where: { classId: cls.id, status: { in: ['BOOKED', 'TRIAL', 'ATTENDED', 'NO_SHOW', 'LATE_CANCELLED'] } },
      include: { profile: true },
      orderBy: { createdAt: 'asc' },
    })
    const attendance = await prisma.attendance.findMany({ where: { classId: cls.id }, include: { profile: true } })
    const people = new Map<string, { profileId: string; name: string; memberCode: string; kind: string; bookingStatus: string | null; checkedInAt: Date | null; method: string | null; payStatus: string }>()
    const label = (name: string, kind: string) => (kind === 'CHILD' ? name.split(' ')[0] + (name.split(' ')[1] ? ` ${name.split(' ')[1][0]}.` : '') : name)
    const payStatus = async (profileId: string) => {
      const plans = await profilePlans(profileId, settings.graceDays)
      if (plans.some((p) => p.status === 'ACTIVE')) return 'PAID'
      if (plans.some((p) => p.status === 'GRACE')) return 'GRACE'
      if (plans.some((p) => p.status === 'FROZEN')) return 'FROZEN'
      return 'DUE'
    }
    for (const b of bookings) {
      people.set(b.profileId, { profileId: b.profileId, name: label(b.profile.name, b.profile.kind), memberCode: memberCode(b.profile.memberNo), kind: b.profile.kind, bookingStatus: b.status, checkedInAt: null, method: null, payStatus: await payStatus(b.profileId) })
    }
    for (const a of attendance) {
      const p = people.get(a.profileId) ?? { profileId: a.profileId, name: label(a.profile.name, a.profile.kind), memberCode: memberCode(a.profile.memberNo), kind: a.profile.kind, bookingStatus: null, checkedInAt: null, method: null, payStatus: await payStatus(a.profileId) }
      p.checkedInAt = a.at
      p.method = a.method
      people.set(a.profileId, p)
    }
    res.json({
      class: { id: cls.id, title: cls.title, program: cls.program.name, startsAt: cls.startsAt, durationMin: cls.durationMin, mode: cls.mode, capacity: cls.capacity, status: cls.status, locationOrLink: cls.locationOrLink },
      people: [...people.values()],
    })
  }),
)

// Rotating class code shown by the coach (ATT-8)
staffRouter.get(
  '/classes/:id/code',
  h(async (req, res) => {
    const cls = await classForStaff(req, String(req.params.id))
    const now = Date.now()
    res.json({ code: classCode(cls.id, now), refreshInSec: 60 - Math.floor((now / 1000) % 60) })
  }),
)

// Call the parent without seeing the number (KID-6); the tap is logged
staffRouter.post(
  '/classes/:id/call/:profileId',
  h(async (req, res) => {
    const cls = await classForStaff(req, String(req.params.id))
    const g = await prisma.guardian.findFirst({ where: { profileId: String(req.params.profileId) }, include: { account: true } })
    const inClass = await prisma.booking.count({ where: { classId: cls.id, profileId: String(req.params.profileId) } })
    if (!g || !inClass) throw notFound('No contact for this person in this class')
    await audit(prisma, req, 'contact.call_tapped', 'Profile', String(req.params.profileId), null, { classId: cls.id })
    res.json({ tel: `tel:+91${g.account.phone}` })
  }),
)

// Message everyone booked in a class (COA-3)
staffRouter.post(
  '/classes/:id/message',
  h(async (req, res) => {
    const cls = await classForStaff(req, String(req.params.id))
    const { text } = parse(z.object({ text: z.string().trim().min(3).max(600) }), req.body)
    const bookings = await prisma.booking.findMany({ where: { classId: cls.id, status: { in: ['BOOKED', 'TRIAL'] } } })
    const accounts = new Set<string>()
    for (const b of bookings) {
      const g = await prisma.guardian.findFirst({ where: { profileId: b.profileId }, orderBy: { createdAt: 'asc' } })
      if (g) accounts.add(g.accountId)
    }
    const stamp = Date.now()
    for (const a of accounts) await sendMessage({ accountId: a, template: 'coach_message', data: { title: cls.title, text: `${text}\n\n- ${req.account!.name}` }, dedupeKey: `cmsg:${cls.id}:${stamp}:${a}` })
    await audit(prisma, req, 'class.messaged', 'Class', cls.id, null, { text, recipients: accounts.size })
    res.json({ ok: true, sent: accounts.size })
  }),
)

// ---------- Series (CLS-5) ----------

const seriesInput = z.object({
  programId: z.string(),
  coachId: z.string(),
  title: z.string().trim().min(2).max(80),
  weekdays: z.array(z.number().int().min(1).max(7)).min(1),
  time: hhmm,
  durationMin: z.number().int().min(15).max(240),
  mode: z.enum(['ONLINE', 'OFFLINE']),
  locationOrLink: z.string().trim().min(2).max(500),
  capacity: z.number().int().min(1).max(200),
  fromDate: day,
  untilDate: day.nullable().optional(),
})

staffRouter.get(
  '/series',
  h(async (req, res) => {
    const acc = req.account!
    const scope = isAdmin(acc.roles) ? {} : { OR: [{ coachId: acc.id }, { program: { coaches: { some: { id: acc.id } } } }] }
    const series = await prisma.classSeries.findMany({ where: { active: true, ...scope }, include: { program: { select: { name: true } }, coach: { select: { name: true } } }, orderBy: { startTimeIst: 'asc' } })
    res.json({ series: series.map((s) => ({ ...s, fromDate: dbDay(s.fromDate), untilDate: s.untilDate ? dbDay(s.untilDate) : null, weekdays: s.weekdays.split(',').map(Number) })) })
  }),
)

staffRouter.post(
  '/series',
  h(async (req, res) => {
    const d = parse(seriesInput, req.body)
    await canManage(req, d.programId, d.coachId)
    checkLocation(d.mode, d.locationOrLink)
    const s = await prisma.classSeries.create({
      data: {
        programId: d.programId, coachId: d.coachId, title: d.title, weekdays: [...new Set(d.weekdays)].sort().join(','), startTimeIst: d.time, durationMin: d.durationMin,
        mode: d.mode, locationOrLink: d.locationOrLink, capacity: d.capacity, fromDate: toDbDate(d.fromDate), untilDate: d.untilDate ? toDbDate(d.untilDate) : null,
      },
    })
    const created = await generateSeriesClasses()
    await audit(prisma, req, 'series.created', 'ClassSeries', s.id, null, d)
    res.status(201).json({ id: s.id, classesCreated: created })
  }),
)

// Edit this and all future classes of a series
staffRouter.patch(
  '/series/:id',
  h(async (req, res) => {
    const s = await prisma.classSeries.findUnique({ where: { id: String(req.params.id) } })
    if (!s) throw notFound('Series not found')
    await canManage(req, s.programId, s.coachId)
    const d = parse(seriesInput.partial(), req.body)
    if (d.mode || d.locationOrLink) checkLocation(d.mode ?? s.mode, d.locationOrLink ?? s.locationOrLink)
    const updated = await prisma.classSeries.update({
      where: { id: s.id },
      data: {
        title: d.title, coachId: d.coachId, durationMin: d.durationMin, mode: d.mode, locationOrLink: d.locationOrLink, capacity: d.capacity,
        startTimeIst: d.time, weekdays: d.weekdays ? [...new Set(d.weekdays)].sort().join(',') : undefined,
        untilDate: d.untilDate === undefined ? undefined : d.untilDate ? toDbDate(d.untilDate) : null,
      },
    })
    // Future classes: those with bookings are updated in place (members told); empty ones are rebuilt
    const future = await prisma.class.findMany({ where: { seriesId: s.id, startsAt: { gt: new Date() }, status: 'SCHEDULED' }, include: { _count: { select: { bookings: { where: { status: 'BOOKED' } } } } } })
    const timeOrDaysChanged = (d.time && d.time !== s.startTimeIst) || d.weekdays
    for (const c of future) {
      if (c._count.bookings === 0 && timeOrDaysChanged) {
        await prisma.class.delete({ where: { id: c.id } })
      } else {
        const startsAt = d.time ? istInstant(istDay(c.startsAt), d.time) : c.startsAt
        await prisma.class.update({ where: { id: c.id }, data: { title: updated.title, coachId: updated.coachId, durationMin: updated.durationMin, mode: updated.mode, locationOrLink: updated.locationOrLink, capacity: updated.capacity, startsAt } })
        if (c._count.bookings && (startsAt.getTime() !== c.startsAt.getTime() || updated.mode !== c.mode || updated.locationOrLink !== c.locationOrLink)) {
          await notifyClassChange(c.id, 'the regular timetable changed', startsAt.getTime() !== c.startsAt.getTime() || updated.mode !== c.mode)
        }
      }
    }
    // Classes beyond a new end date are cancelled with notice
    if (updated.untilDate) {
      const beyond = await prisma.class.findMany({ where: { seriesId: s.id, status: 'SCHEDULED', startsAt: { gte: istInstant(dbDay(new Date(updated.untilDate.getTime() + 86_400_000)), '00:00') } } })
      for (const c of beyond) await studioCancelClass(c.id, 'Series ended')
    }
    await generateSeriesClasses()
    await audit(prisma, req, 'series.updated', 'ClassSeries', s.id, s, updated)
    res.json({ ok: true })
  }),
)

staffRouter.delete(
  '/series/:id',
  h(async (req, res) => {
    const s = await prisma.classSeries.findUnique({ where: { id: String(req.params.id) } })
    if (!s) throw notFound('Series not found')
    await canManage(req, s.programId, s.coachId)
    await prisma.classSeries.update({ where: { id: s.id }, data: { active: false, untilDate: toDbDate(todayIst()) } })
    const future = await prisma.class.findMany({ where: { seriesId: s.id, status: 'SCHEDULED', startsAt: { gt: new Date() } } })
    for (const c of future) await studioCancelClass(c.id, 'Removed from the timetable')
    await audit(prisma, req, 'series.ended', 'ClassSeries', s.id)
    res.json({ ok: true, cancelled: future.length })
  }),
)

// ---------- Closures (CLS-8), admin only ----------

staffRouter.get(
  '/closures',
  h(async (_req, res) => {
    const rows = await prisma.closure.findMany({ where: { toDate: { gte: toDbDate(todayIst()) } }, orderBy: { fromDate: 'asc' } })
    res.json({ closures: rows.map((c) => ({ id: c.id, fromDate: dbDay(c.fromDate), toDate: dbDay(c.toDate), reason: c.reason })) })
  }),
)

staffRouter.post(
  '/closures',
  requireAdmin,
  h(async (req, res) => {
    const d = parse(z.object({ fromDate: day, toDate: day, reason: z.string().trim().min(2).max(200) }), req.body)
    if (d.toDate < d.fromDate) throw forbidden('The end date must be on or after the start date')
    const c = await prisma.closure.create({ data: { fromDate: toDbDate(d.fromDate), toDate: toDbDate(d.toDate), reason: d.reason } })
    const affected = await prisma.class.findMany({ where: { status: 'SCHEDULED', startsAt: { gte: istInstant(d.fromDate, '00:00'), lt: new Date(istInstant(d.toDate, '00:00').getTime() + 86_400_000) } } })
    for (const cls of affected) await studioCancelClass(cls.id, `Studio closed: ${d.reason}`)
    await audit(prisma, req, 'closure.created', 'Closure', c.id, null, d)
    res.status(201).json({ id: c.id, cancelled: affected.length })
  }),
)

staffRouter.delete(
  '/closures/:id',
  requireAdmin,
  h(async (req, res) => {
    await prisma.closure.delete({ where: { id: String(req.params.id) } })
    await generateSeriesClasses()
    await audit(prisma, req, 'closure.removed', 'Closure', String(req.params.id))
    res.json({ ok: true })
  }),
)

// Any staff member changes their own password
staffRouter.post(
  '/password',
  h(async (req, res) => {
    const d = parse(z.object({ current: z.string(), next: z.string().min(10, 'Use at least 10 characters').max(200) }), req.body)
    const acc = await prisma.account.findUniqueOrThrow({ where: { id: req.account!.id } })
    if (!(await verifyPassword(d.current, acc.passwordHash))) throw badRequest('Your current password is not right')
    await prisma.account.update({ where: { id: acc.id }, data: { passwordHash: await hashPassword(d.next) } })
    await audit(prisma, req, 'staff.password_changed', 'Account', acc.id)
    res.json({ ok: true })
  }),
)

