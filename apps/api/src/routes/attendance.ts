// Check-in: QR scan (online and offline), class code, staff manual mark (ATT-1 to ATT-11, section 9)
import { Router, type Request } from 'express'
import { z } from 'zod'
import { containsText, prisma } from '../db'
import { audit } from '../lib/audit'
import { assertProfileAccess, isAdmin, requireAuth, requireStaff } from '../lib/auth'
import { classCode } from '../lib/crypto'
import { badRequest, conflict, forbidden, h, HttpError, notFound, parse } from '../lib/http'
import { publicKeyRaw, signToken, verifyToken } from '../lib/qr'
import { getSettings } from '../lib/settings'
import { istDayStart, todayIst } from '../lib/time'
import { addDays } from '../domain/dates'
import { memberCode } from '../domain/upi'
import { profilePlans } from '../services/memberships'
import { bookClass } from '../services/schedule'

export const attendanceRouter = Router()
attendanceRouter.use(requireAuth)

const LIVE_SECONDS = 90

attendanceRouter.get('/public-key', (_req, res) => {
  res.json({ publicKey: publicKeyRaw() })
})

// Member QR: a live token (90 s) plus a day pass for when the phone goes offline (9.1, 9.2)
attendanceRouter.get(
  '/token/:profileId',
  h(async (req, res) => {
    const profileId = String(req.params.profileId)
    await assertProfileAccess(req, profileId)
    const now = Math.floor(Date.now() / 1000)
    const dayEnd = Math.floor(istDayStart(addDays(todayIst(), 1)).getTime() / 1000) - 1
    res.json({
      token: signToken({ p: profileId, e: now + LIVE_SECONDS, t: 'live' }),
      expiresAt: (now + LIVE_SECONDS) * 1000,
      dayPass: signToken({ p: profileId, e: dayEnd, t: 'day' }),
      dayPassExpiresAt: dayEnd * 1000,
    })
  }),
)

async function staffClass(req: Request, classId: string) {
  const cls = await prisma.class.findUnique({ where: { id: classId }, include: { program: true } })
  if (!cls) throw notFound('Class not found')
  const acc = req.account!
  if (!isAdmin(acc.roles) && cls.coachId !== acc.id) {
    const own = await prisma.program.count({ where: { id: cls.programId, coaches: { some: { id: acc.id } } } })
    if (!own) throw forbidden('You can only take attendance for your own classes')
  }
  return cls
}

async function payStatus(profileId: string) {
  const s = await getSettings()
  const plans = await profilePlans(profileId, s.graceDays)
  const best = plans.find((p) => p.status === 'ACTIVE') ?? plans.find((p) => p.status === 'GRACE') ?? plans.find((p) => p.status === 'FROZEN')
  return { status: best?.status ?? 'DUE', creditsLeft: best?.creditsLeft ?? null, blockIfDue: s.blockIfDue }
}

type CheckIn = { classId: string; profileId: string; method: 'QR' | 'QR_OFFLINE' | 'CODE' | 'MANUAL' | 'WALKIN'; byAccountId: string | null; at?: Date; deviceScanId?: string; reason?: string; allowWalkIn?: boolean }

/** Records one check-in; duplicate-safe by (class, profile) and device scan ID (ATT-3, ATT-6) */
async function recordCheckIn(c: CheckIn) {
  const profile = await prisma.profile.findUniqueOrThrow({ where: { id: c.profileId } })
  const person = { profileId: profile.id, name: profile.name, memberCode: memberCode(profile.memberNo), kind: profile.kind }
  const existing = await prisma.attendance.findUnique({ where: { classId_profileId: { classId: c.classId, profileId: c.profileId } } })
  if (existing) return { result: 'already' as const, at: existing.at, person }
  if (c.deviceScanId && (await prisma.attendance.findUnique({ where: { deviceScanId: c.deviceScanId } }))) return { result: 'already' as const, at: c.at ?? new Date(), person }
  const pay = await payStatus(c.profileId)
  if (pay.status === 'DUE' && pay.blockIfDue && c.method !== 'MANUAL') {
    return { result: 'blocked' as const, message: 'Membership is due. Please see the front desk.', person, pay }
  }
  let booking = await prisma.booking.findUnique({ where: { classId_profileId: { classId: c.classId, profileId: c.profileId } } })
  if (!booking || !['BOOKED', 'TRIAL', 'NO_SHOW', 'LATE_CANCELLED'].includes(booking.status)) {
    if (!c.allowWalkIn) return { result: 'not_booked' as const, message: `${profile.name} is not booked for this class`, person, pay }
    booking = await bookClass(c.profileId, c.classId, { walkIn: true }) // BKG-10: capacity and plan rules still apply
  }
  await prisma.$transaction([
    prisma.attendance.create({ data: { classId: c.classId, profileId: c.profileId, method: c.method, byAccountId: c.byAccountId, at: c.at ?? new Date(), deviceScanId: c.deviceScanId, reason: c.reason } }),
    prisma.booking.update({ where: { id: booking.id }, data: { status: booking.status === 'TRIAL' ? 'TRIAL' : 'ATTENDED' } }),
  ])
  if (booking.status === 'TRIAL') await prisma.lead.updateMany({ where: { trialBookingId: booking.id }, data: { status: 'ATTENDED' } })
  return { result: 'ok' as const, person, pay }
}

const scanInput = z.object({
  classId: z.string(),
  token: z.string().max(1000),
  deviceScanId: z.string().max(64).optional(),
  scannedAt: z.coerce.date().optional(),
  allowWalkIn: z.boolean().optional(),
})

attendanceRouter.post(
  '/scan',
  requireStaff,
  h(async (req, res) => {
    const d = parse(scanInput, req.body)
    const cls = await staffClass(req, d.classId)
    // A queued offline scan is checked against the time it was scanned, not now
    const v = verifyToken(d.token, d.scannedAt ? Math.min(d.scannedAt.getTime(), Date.now()) : Date.now())
    if (!v.ok) throw badRequest(v.reason, 'BAD_TOKEN')
    const r = await recordCheckIn({ classId: cls.id, profileId: v.payload.p, method: d.scannedAt ? 'QR_OFFLINE' : 'QR', byAccountId: req.account!.id, at: d.scannedAt, deviceScanId: d.deviceScanId, allowWalkIn: d.allowWalkIn })
    res.json({ ...r, dayPass: v.payload.t === 'day' })
  }),
)

// Offline queue sync (ATT-6): each scan is processed independently
attendanceRouter.post(
  '/sync',
  requireStaff,
  h(async (req, res) => {
    const { scans } = parse(z.object({ scans: z.array(scanInput.extend({ deviceScanId: z.string().max(64) })).max(500) }), req.body)
    const results = []
    for (const s of scans) {
      try {
        const cls = await staffClass(req, s.classId)
        const v = verifyToken(s.token, Math.min(s.scannedAt?.getTime() ?? Date.now(), Date.now()))
        if (!v.ok) {
          results.push({ deviceScanId: s.deviceScanId, result: 'invalid', message: v.reason })
          continue
        }
        const r = await recordCheckIn({ classId: cls.id, profileId: v.payload.p, method: 'QR_OFFLINE', byAccountId: req.account!.id, at: s.scannedAt, deviceScanId: s.deviceScanId })
        results.push({ deviceScanId: s.deviceScanId, ...r })
      } catch (e) {
        results.push({ deviceScanId: s.deviceScanId, result: 'error', message: e instanceof HttpError ? e.message : 'Could not sync' })
      }
    }
    res.json({ results })
  }),
)

// Staff manual check-in with a reason (ATT-7) and walk-ins (BKG-10)
attendanceRouter.post(
  '/manual',
  requireStaff,
  h(async (req, res) => {
    const d = parse(z.object({ classId: z.string(), profileId: z.string(), reason: z.string().trim().min(3, 'Add a short reason').max(200), walkIn: z.boolean().default(false) }), req.body)
    const cls = await staffClass(req, d.classId)
    const r = await recordCheckIn({ classId: cls.id, profileId: d.profileId, method: d.walkIn ? 'WALKIN' : 'MANUAL', byAccountId: req.account!.id, reason: d.reason, allowWalkIn: d.walkIn })
    await audit(prisma, req, 'attendance.manual', 'Class', cls.id, null, { profileId: d.profileId, reason: d.reason, result: r.result })
    res.json(r)
  }),
)

// Staff search for manual check-in
attendanceRouter.get(
  '/search',
  requireStaff,
  h(async (req, res) => {
    const { q } = parse(z.object({ q: z.string().trim().min(2).max(40) }), req.query)
    const no = Number(q.replace(/^uf/i, ''))
    const rows = await prisma.profile.findMany({
      where: { OR: [{ name: containsText(q) }, ...(Number.isFinite(no) && no > 0 ? [{ memberNo: no }] : [])] },
      take: 10,
    })
    res.json({ people: rows.map((p) => ({ profileId: p.id, name: p.name, memberCode: memberCode(p.memberNo), kind: p.kind })) })
  }),
)

// Correction within 24 hours of the class (BKG-6, ATT-11)
attendanceRouter.delete(
  '/:classId/:profileId',
  requireStaff,
  h(async (req, res) => {
    const cls = await staffClass(req, String(req.params.classId))
    const end = cls.startsAt.getTime() + cls.durationMin * 60_000
    if (Date.now() > end + 24 * 3600_000 && !isAdmin(req.account!.roles)) throw forbidden('Attendance can be corrected up to 24 hours after the class')
    const a = await prisma.attendance.findUnique({ where: { classId_profileId: { classId: cls.id, profileId: String(req.params.profileId) } } })
    if (!a) throw notFound('No check-in to remove')
    await prisma.attendance.delete({ where: { id: a.id } })
    await prisma.booking.updateMany({ where: { classId: cls.id, profileId: a.profileId, status: 'ATTENDED' }, data: { status: Date.now() > end ? 'NO_SHOW' : 'BOOKED' } })
    await audit(prisma, req, 'attendance.removed', 'Class', cls.id, a, null)
    res.json({ ok: true })
  }),
)

// Member types the coach's class code (ATT-8, ATT-9)
attendanceRouter.post(
  '/code',
  h(async (req, res) => {
    const d = parse(z.object({ classId: z.string(), profileId: z.string(), code: z.string().regex(/^\d{4}$/, 'Enter the 4-digit code') }), req.body)
    await assertProfileAccess(req, d.profileId)
    const cls = await prisma.class.findUnique({ where: { id: d.classId } })
    if (!cls || cls.status === 'CANCELLED') throw notFound('Class not found')
    const now = Date.now()
    if (now < cls.startsAt.getTime() - 10 * 60_000 || now > cls.startsAt.getTime() + 20 * 60_000) throw conflict('Check-in by code is open from 10 minutes before to 20 minutes after the start', 'CODE_WINDOW')
    // accept this minute's and last minute's code so a change mid-typing still works
    if (d.code !== classCode(cls.id, now) && d.code !== classCode(cls.id, now - 60_000)) throw badRequest('That code is not right. Check the code your coach is showing.', 'BAD_CODE')
    const r = await recordCheckIn({ classId: cls.id, profileId: d.profileId, method: 'CODE', byAccountId: req.account!.id })
    res.json(r)
  }),
)

// Tapping the meeting link is recorded as "joined", a hint for the coach only (ATT-9, ATT-10)
attendanceRouter.post(
  '/joined',
  h(async (req, res) => {
    const d = parse(z.object({ classId: z.string(), profileId: z.string() }), req.body)
    await assertProfileAccess(req, d.profileId)
    await audit(prisma, req, 'online.joined', 'Class', d.classId, null, { profileId: d.profileId })
    res.json({ ok: true })
  }),
)

attendanceRouter.get(
  '/joined/:classId',
  requireStaff,
  h(async (req, res) => {
    const cls = await staffClass(req, String(req.params.classId))
    const rows = await prisma.auditLog.findMany({ where: { action: 'online.joined', entity: 'Class', entityId: cls.id } })
    res.json({ profileIds: [...new Set(rows.map((r) => (r.newValue as { profileId: string }).profileId))] })
  }),
)
