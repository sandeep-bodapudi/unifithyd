// Admin dashboard, members, staff, leads, settings, audit, reports, import (ADM-1 to ADM-8, LEAD-3, MIG-1 to MIG-4)
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db'
import { addDays, addMonthsClamped, type Day } from '../domain/dates'
import { isValidUpiId, memberCode } from '../domain/upi'
import { audit } from '../lib/audit'
import { requireAdmin, requireRole } from '../lib/auth'
import { hashCode, hashPassword, randomToken, safeEqual, sixDigits, verifyPassword } from '../lib/crypto'
import { badRequest, conflict, forbidden, h, HttpError, notFound, parse } from '../lib/http'
import { notifyAdmins, sendMessage } from '../lib/messages'
import { getSettings, setSettings } from '../lib/settings'
import { dbDay, istInstant, todayIst, toDbDate } from '../lib/time'
import { profilePlans } from '../services/memberships'
import { freezeMembership } from '../services/payments'
import { DOC_VERSIONS } from './auth'

export const adminRouter = Router()
adminRouter.use(requireAdmin)

const dayStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

// ---------- Dashboard (ADM-1, ADM-2) ----------

adminRouter.get(
  '/dashboard',
  h(async (_req, res) => {
    const s = await getSettings()
    const today = todayIst()
    const dayStart = istInstant(today, '00:00')
    const dayEnd = new Date(dayStart.getTime() + 86_400_000)
    const profiles = await prisma.profile.findMany({ select: { id: true } })
    let active = 0
    let grace = 0
    let due = 0
    for (const p of profiles) {
      const plans = await profilePlans(p.id, s.graceDays, today)
      if (!plans.length) continue
      if (plans.some((x) => x.status === 'ACTIVE' || x.status === 'FROZEN' || x.status === 'SCHEDULED')) active++
      else if (plans.some((x) => x.status === 'GRACE')) grace++
      else due++
    }
    const monthStart = `${today.slice(0, 7)}-01`
    const [pending, classes, checkedIn, collected, leads] = await Promise.all([
      prisma.payment.count({ where: { status: 'PENDING' } }),
      prisma.class.findMany({
        where: { startsAt: { gte: dayStart, lt: dayEnd } },
        orderBy: { startsAt: 'asc' },
        include: { coach: { select: { name: true } }, _count: { select: { bookings: { where: { status: { in: ['BOOKED', 'TRIAL', 'ATTENDED', 'NO_SHOW'] } } }, attendance: true } } },
      }),
      prisma.attendance.count({ where: { at: { gte: dayStart, lt: dayEnd } } }),
      prisma.payment.aggregate({ where: { status: 'VERIFIED', paidOn: { gte: toDbDate(monthStart), lte: toDbDate(today) } }, _sum: { amountPaise: true } }),
      prisma.lead.count({ where: { status: { in: ['NEW', 'TRIAL_BOOKED', 'ATTENDED'] }, OR: [{ followUpOn: null }, { followUpOn: { lte: toDbDate(today) } }] } }),
    ])
    res.json({
      cards: { active, grace, due, pending, classesToday: classes.filter((c) => c.status !== 'CANCELLED').length, checkedInToday: checkedIn, collectedThisMonthPaise: collected._sum.amountPaise ?? 0, leadsToFollow: leads },
      today: classes.map((c) => ({ id: c.id, title: c.title, startsAt: c.startsAt, mode: c.mode, coach: c.coach.name, capacity: c.capacity, booked: c._count.bookings, checkedIn: c._count.attendance, status: c.status })),
    })
  }),
)

// ---------- Members (ADM-3, ADM-4) ----------

adminRouter.get(
  '/members',
  h(async (req, res) => {
    const q = parse(z.object({ q: z.string().trim().max(60).optional(), status: z.enum(['ALL', 'ACTIVE', 'GRACE', 'DUE', 'NONE']).default('ALL'), programId: z.string().optional() }), req.query)
    const s = await getSettings()
    const no = q.q ? Number(q.q.replace(/^uf/i, '')) : NaN
    const profiles = await prisma.profile.findMany({
      where: q.q ? { OR: [{ name: { contains: q.q } }, { guardians: { some: { account: { OR: [{ phone: { contains: q.q } }, { email: { contains: q.q } }] } } } }, ...(Number.isFinite(no) && no > 0 ? [{ memberNo: no }] : [])] } : {},
      include: { guardians: { include: { account: true } }, _count: { select: { attendance: true } }, memberships: { where: { status: { not: 'CANCELLED' } }, select: { plan: { select: { programs: { select: { programId: true } } } } } } },
      orderBy: { memberNo: 'asc' },
      take: 500,
    })
    const out = []
    for (const p of profiles) {
      if (q.programId && !p.memberships.some((m) => m.plan.programs.some((x) => x.programId === q.programId))) continue
      const plans = await profilePlans(p.id, s.graceDays)
      const status = plans.find((x) => x.status === 'ACTIVE')?.status ?? plans.find((x) => x.status === 'FROZEN')?.status ?? plans.find((x) => x.status === 'SCHEDULED')?.status ?? plans.find((x) => x.status === 'GRACE')?.status ?? (plans.length ? 'DUE' : 'NONE')
      if (q.status !== 'ALL' && !(q.status === 'ACTIVE' ? ['ACTIVE', 'FROZEN', 'SCHEDULED'].includes(status) : status === q.status)) continue
      const g = p.guardians[0]?.account
      const latestEnd = plans.map((x) => x.end).sort().at(-1) ?? null
      out.push({
        profileId: p.id, name: p.name, memberCode: memberCode(p.memberNo), kind: p.kind, status, plans: plans.map((x) => x.planName), paidUntil: latestEnd,
        dueDays: status === 'DUE' && latestEnd ? Math.max(0, Math.round((Date.parse(todayIst()) - Date.parse(latestEnd)) / 86_400_000)) : 0,
        attended: p._count.attendance, account: g ? { id: g.id, name: g.name, phone: g.phone, email: g.email, disabled: g.disabled } : null,
      })
    }
    res.json({ members: out })
  }),
)

adminRouter.get(
  '/members/:profileId',
  h(async (req, res) => {
    const s = await getSettings()
    const p = await prisma.profile.findUnique({
      where: { id: String(req.params.profileId) },
      include: {
        guardians: { include: { account: { include: { roles: true } } } },
        consents: { orderBy: { acceptedAt: 'desc' } },
        memberships: { include: { plan: true, freezes: true }, orderBy: { startDate: 'desc' } },
        payments: { include: { plan: true, receipts: true }, orderBy: { createdAt: 'desc' } },
        bookings: { include: { class: { select: { title: true, startsAt: true, mode: true } } }, orderBy: { createdAt: 'desc' }, take: 40 },
        credits: { orderBy: { createdAt: 'desc' } },
      },
    })
    if (!p) throw notFound('Member not found')
    const accountIds = p.guardians.map((g) => g.accountId)
    const [messages, trail] = await Promise.all([
      prisma.messageLog.findMany({ where: { accountId: { in: accountIds } }, orderBy: { createdAt: 'desc' }, take: 30 }),
      prisma.auditLog.findMany({ where: { OR: [{ entityId: p.id }, { entityId: { in: [...p.payments.map((x) => x.id), ...p.memberships.map((x) => x.id)] } }] }, orderBy: { at: 'desc' }, take: 40 }),
    ])
    res.json({
      profile: { id: p.id, name: p.name, memberCode: memberCode(p.memberNo), kind: p.kind, dob: dbDay(p.dob), emergencyNote: p.emergencyNote, photoConsent: p.photoConsent, createdAt: p.createdAt },
      accounts: p.guardians.map((g) => ({ id: g.account.id, name: g.account.name, email: g.account.email, phone: g.account.phone, disabled: g.account.disabled, roles: g.account.roles.map((r) => r.role) })),
      plans: await profilePlans(p.id, s.graceDays),
      memberships: p.memberships.map((m) => ({ id: m.id, plan: m.plan.name, start: dbDay(m.startDate), end: dbDay(m.endDate), status: m.status, source: m.source, freezes: m.freezes.map((f) => ({ start: dbDay(f.startDate), days: f.days, reason: f.reason })) })),
      payments: p.payments.map((x) => ({ id: x.id, plan: x.plan.name, amountPaise: x.amountPaise, method: x.method, status: x.status, utr: x.utr, paidOn: dbDay(x.paidOn), reason: x.reason, receipts: x.receipts.map((r) => ({ number: r.number, kind: r.kind })) })),
      bookings: p.bookings.map((b) => ({ id: b.id, status: b.status, title: b.class.title, startsAt: b.class.startsAt, mode: b.class.mode })),
      credits: p.credits.map((c) => ({ delta: c.delta, kind: c.kind, expiresOn: c.expiresOn ? dbDay(c.expiresOn) : null, reason: c.reason })),
      consents: p.consents.map((c) => ({ document: c.document, version: c.version, acceptedAt: c.acceptedAt })),
      messages: messages.map((m) => ({ template: m.template, channel: m.channel, status: m.status, at: m.sentAt ?? m.createdAt })),
      audit: trail,
    })
  }),
)

adminRouter.post(
  '/memberships/:id/freeze',
  h(async (req, res) => {
    const d = parse(z.object({ startDay: dayStr, days: z.number().int().min(1).max(14), reason: z.string().trim().min(3).max(200) }), req.body)
    res.json(await freezeMembership(req, String(req.params.id), d.startDay, d.days, d.reason))
  }),
)

adminRouter.post(
  '/members/:profileId/makeup',
  h(async (req, res) => {
    const d = parse(z.object({ count: z.number().int().min(1).max(5), expiresOn: dayStr, reason: z.string().trim().min(3).max(200) }), req.body)
    const c = await prisma.creditAdjustment.create({ data: { profileId: String(req.params.profileId), delta: d.count, kind: 'MAKEUP', expiresOn: toDbDate(d.expiresOn), reason: d.reason, byAccountId: req.account!.id } })
    await audit(prisma, req, 'credit.makeup', 'Profile', String(req.params.profileId), null, d)
    res.status(201).json({ id: c.id })
  }),
)

adminRouter.patch(
  '/members/:profileId',
  h(async (req, res) => {
    const d = parse(z.object({ name: z.string().trim().min(2).max(80).optional(), emergencyNote: z.string().max(500).nullable().optional(), photoConsent: z.boolean().optional() }), req.body)
    const before = await prisma.profile.findUniqueOrThrow({ where: { id: String(req.params.profileId) } })
    await prisma.profile.update({ where: { id: before.id }, data: d })
    await audit(prisma, req, 'profile.updated', 'Profile', before.id, before, d)
    res.json({ ok: true })
  }),
)

// ACC-8: disable or enable an account
adminRouter.post(
  '/accounts/:id/disabled',
  h(async (req, res) => {
    const { disabled } = parse(z.object({ disabled: z.boolean() }), req.body)
    const acc = await prisma.account.findUniqueOrThrow({ where: { id: String(req.params.id) }, include: { roles: true } })
    if (acc.roles.some((r) => r.role === 'OWNER')) throw forbidden('The owner account cannot be disabled')
    await prisma.account.update({ where: { id: acc.id }, data: { disabled } })
    if (disabled) await prisma.session.updateMany({ where: { accountId: acc.id, revokedAt: null }, data: { revokedAt: new Date() } })
    await audit(prisma, req, disabled ? 'account.disabled' : 'account.enabled', 'Account', acc.id)
    res.json({ ok: true })
  }),
)

// ACC-7: anonymise a member; payments and receipts stay for accounting (14.3)
adminRouter.post(
  '/members/:profileId/anonymise',
  h(async (req, res) => {
    const p = await prisma.profile.findUniqueOrThrow({ where: { id: String(req.params.profileId) }, include: { guardians: true } })
    await prisma.$transaction(async (tx) => {
      await tx.profile.update({ where: { id: p.id }, data: { name: `Deleted member ${memberCode(p.memberNo)}`, photoUrl: null, emergencyNote: null, dob: toDbDate('1900-01-01') } })
      await tx.weightLog.deleteMany({ where: { profileId: p.id } })
      for (const g of p.guardians) {
        const others = await tx.guardian.count({ where: { accountId: g.accountId, profileId: { not: p.id } } })
        if (!others) {
          const tag = randomToken(6)
          await tx.account.update({ where: { id: g.accountId }, data: { name: 'Deleted', email: `deleted-${tag}@invalid`, phone: `0${tag}`.slice(0, 10), disabled: true } })
          await tx.session.updateMany({ where: { accountId: g.accountId }, data: { revokedAt: new Date() } })
        }
      }
    })
    await audit(prisma, req, 'privacy.anonymised', 'Profile', p.id)
    res.json({ ok: true })
  }),
)

// ---------- Staff (ADM-8): owner only ----------

const ownerOnly = requireRole('OWNER')

adminRouter.get(
  '/staff',
  h(async (_req, res) => {
    const rows = await prisma.account.findMany({ where: { roles: { some: { role: { in: ['COACH', 'ADMIN', 'OWNER'] } } } }, include: { roles: true, coachPrograms: { select: { id: true, name: true } } }, orderBy: { name: 'asc' } })
    res.json({ staff: rows.map((a) => ({ id: a.id, name: a.name, email: a.email, phone: a.phone, disabled: a.disabled, roles: a.roles.map((r) => r.role), programs: a.coachPrograms })) })
  }),
)

adminRouter.post(
  '/staff',
  ownerOnly,
  h(async (req, res) => {
    const d = parse(
      z.object({ name: z.string().trim().min(2).max(80), email: z.string().trim().toLowerCase().email(), phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'), role: z.enum(['COACH', 'ADMIN']), programIds: z.array(z.string()).default([]) }),
      req.body,
    )
    const tempPassword = randomToken(9)
    const existing = await prisma.account.findFirst({ where: { OR: [{ email: d.email }, { phone: d.phone }] } })
    let accountId: string
    if (existing) {
      if (existing.email !== d.email) throw conflict('That phone number belongs to another account')
      accountId = existing.id
      await prisma.accountRole.upsert({ where: { accountId_role: { accountId, role: d.role } }, update: {}, create: { accountId, role: d.role } })
      if (!existing.passwordHash) await prisma.account.update({ where: { id: accountId }, data: { passwordHash: await hashPassword(tempPassword) } })
    } else {
      const acc = await prisma.account.create({ data: { name: d.name, email: d.email, phone: d.phone, passwordHash: await hashPassword(tempPassword), roles: { create: [{ role: d.role }] } } })
      accountId = acc.id
    }
    await prisma.account.update({ where: { id: accountId }, data: { coachPrograms: { set: d.programIds.map((id) => ({ id })) } } })
    await audit(prisma, req, 'staff.added', 'Account', accountId, null, { role: d.role, programIds: d.programIds })
    // The temporary password is shown once to the owner, never stored in plain text or emailed
    res.status(201).json({ id: accountId, tempPassword: existing?.passwordHash ? null : tempPassword })
  }),
)

adminRouter.patch(
  '/staff/:id',
  ownerOnly,
  h(async (req, res) => {
    const d = parse(z.object({ roles: z.array(z.enum(['COACH', 'ADMIN'])).optional(), programIds: z.array(z.string()).optional(), disabled: z.boolean().optional() }), req.body)
    const acc = await prisma.account.findUniqueOrThrow({ where: { id: String(req.params.id) }, include: { roles: true } })
    if (acc.roles.some((r) => r.role === 'OWNER') && d.disabled) throw forbidden('The owner cannot be disabled')
    if (d.roles) {
      await prisma.accountRole.deleteMany({ where: { accountId: acc.id, role: { in: ['COACH', 'ADMIN'] } } })
      for (const role of d.roles) await prisma.accountRole.create({ data: { accountId: acc.id, role } })
    }
    if (d.programIds) await prisma.account.update({ where: { id: acc.id }, data: { coachPrograms: { set: d.programIds.map((id) => ({ id })) } } })
    if (d.disabled !== undefined) {
      await prisma.account.update({ where: { id: acc.id }, data: { disabled: d.disabled } })
      if (d.disabled) await prisma.session.updateMany({ where: { accountId: acc.id, revokedAt: null }, data: { revokedAt: new Date() } })
    }
    await audit(prisma, req, 'staff.updated', 'Account', acc.id, { roles: acc.roles.map((r) => r.role) }, d)
    res.json({ ok: true })
  }),
)

adminRouter.post(
  '/staff/:id/reset-password',
  ownerOnly,
  h(async (req, res) => {
    const tempPassword = randomToken(9)
    await prisma.account.update({ where: { id: String(req.params.id) }, data: { passwordHash: await hashPassword(tempPassword) } })
    await prisma.session.updateMany({ where: { accountId: String(req.params.id), revokedAt: null }, data: { revokedAt: new Date() } })
    await audit(prisma, req, 'staff.password_reset', 'Account', String(req.params.id))
    res.json({ tempPassword })
  }),
)

// ---------- Programs and plans ----------

adminRouter.get(
  '/plans',
  h(async (_req, res) => {
    const [plans, programs] = await Promise.all([
      prisma.plan.findMany({ include: { programs: { include: { program: true } } }, orderBy: { pricePaise: 'asc' } }),
      prisma.program.findMany({ orderBy: { name: 'asc' } }),
    ])
    res.json({ plans: plans.map((p) => ({ ...p, programs: p.programs.map((x) => ({ id: x.programId, name: x.program.name })) })), programs })
  }),
)

const planInput = z.object({
  name: z.string().trim().min(2).max(60),
  shortCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,8}$/, 'Short code: 2 to 8 letters or digits'),
  pricePaise: z.number().int().positive(),
  cycleMonths: z.number().int().min(1).max(12),
  creditsPerCycle: z.number().int().min(1).max(100).nullable(),
  weeklyCap: z.number().int().min(1).max(14).nullable(),
  audience: z.enum(['KIDS', 'ADULTS', 'MIXED']),
  public: z.boolean(),
  active: z.boolean(),
  programIds: z.array(z.string()).min(1, 'Pick at least one program'),
})

adminRouter.post(
  '/plans',
  h(async (req, res) => {
    const { programIds, ...d } = parse(planInput, req.body)
    const p = await prisma.plan.create({ data: { ...d, programs: { create: programIds.map((programId) => ({ programId })) } } })
    await audit(prisma, req, 'plan.created', 'Plan', p.id, null, d)
    res.status(201).json({ id: p.id })
  }),
)

adminRouter.patch(
  '/plans/:id',
  h(async (req, res) => {
    const { programIds, ...d } = parse(planInput.partial(), req.body)
    const before = await prisma.plan.findUniqueOrThrow({ where: { id: String(req.params.id) } })
    await prisma.plan.update({ where: { id: before.id }, data: d })
    if (programIds) {
      await prisma.planProgram.deleteMany({ where: { planId: before.id } })
      await prisma.planProgram.createMany({ data: programIds.map((programId) => ({ planId: before.id, programId })) })
    }
    await audit(prisma, req, 'plan.updated', 'Plan', before.id, before, { ...d, programIds })
    res.json({ ok: true })
  }),
)

adminRouter.post(
  '/programs',
  h(async (req, res) => {
    const d = parse(z.object({ name: z.string().trim().min(2).max(60), audience: z.enum(['KIDS', 'ADULTS', 'MIXED']), defaultCapacity: z.number().int().min(1).max(200) }), req.body)
    const p = await prisma.program.create({ data: d })
    await audit(prisma, req, 'program.created', 'Program', p.id, null, d)
    res.status(201).json({ id: p.id })
  }),
)

// ---------- Settings (ADM-7, PAY-1 to PAY-3) ----------

adminRouter.get(
  '/settings',
  h(async (_req, res) => {
    res.json({ settings: await getSettings() })
  }),
)

adminRouter.patch(
  '/settings',
  h(async (req, res) => {
    const d = parse(
      z.object({
        studioName: z.string().trim().min(2).max(60).optional(),
        cancellationCutoffHours: z.number().int().min(0).max(48).optional(),
        reminderHoursBefore: z.number().int().min(1).max(24).optional(),
        graceDays: z.number().int().min(0).max(14).optional(),
        blockIfDue: z.boolean().optional(),
        gstEnabled: z.boolean().optional(),
        gstNumber: z.string().trim().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, 'Enter a valid 15-character GSTIN').nullable().optional(),
        gstRatePercent: z.number().min(0).max(28).optional(),
      }),
      req.body,
    )
    if (d.gstEnabled && !(d.gstNumber ?? (await getSettings()).gstNumber)) throw badRequest('Add the GST number before turning GST on')
    const before = await getSettings()
    await setSettings(d, req.account!.id)
    await audit(prisma, req, 'settings.updated', 'Setting', null, Object.fromEntries(Object.keys(d).map((k) => [k, before[k as keyof typeof before]])), d)
    res.json({ ok: true })
  }),
)

// PAY-2 step 1: confirm password, get a fresh code
adminRouter.post(
  '/settings/upi/start',
  h(async (req, res) => {
    const { password } = parse(z.object({ password: z.string().min(1) }), req.body)
    const acc = await prisma.account.findUniqueOrThrow({ where: { id: req.account!.id } })
    if (!(await verifyPassword(password, acc.passwordHash))) throw new HttpError(401, 'BAD_PASSWORD', 'Your password is not right')
    const code = sixDigits()
    const row = await prisma.loginCode.create({ data: { accountId: acc.id, channel: 'EMAIL', purpose: 'upi-change', codeHash: hashCode(acc.id, code), expiresAt: new Date(Date.now() + 10 * 60_000) } })
    await sendMessage({ accountId: acc.id, template: 'login_code', data: { code }, dedupeKey: `code:${row.id}` })
    const { env, isProd } = await import('../env')
    res.json({ ok: true, ...(!isProd && env.DEV_SHOW_CODES ? { devCode: code } : {}) })
  }),
)

// PAY-2 step 2: with the code, schedule the change 15 minutes ahead and alert every admin
adminRouter.post(
  '/settings/upi',
  h(async (req, res) => {
    const d = parse(z.object({ code: z.string().regex(/^\d{6}$/), upiId: z.string().trim(), upiPayeeName: z.string().trim().min(2).max(60) }), req.body)
    if (!isValidUpiId(d.upiId)) throw badRequest('That does not look like a UPI ID (name@bank)')
    const lc = await prisma.loginCode.findFirst({ where: { accountId: req.account!.id, purpose: 'upi-change', usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' } })
    if (!lc || lc.attempts >= 5 || !safeEqual(lc.codeHash, hashCode(req.account!.id, d.code))) {
      if (lc) await prisma.loginCode.update({ where: { id: lc.id }, data: { attempts: { increment: 1 } } })
      throw badRequest('That code is not right or has expired', 'BAD_CODE')
    }
    await prisma.loginCode.update({ where: { id: lc.id }, data: { usedAt: new Date() } })
    const before = await getSettings()
    const isOwner = req.account!.roles.includes('OWNER')
    const effectiveAt = new Date(Date.now() + (isOwner || !before.upiId ? 0 : 15 * 60_000))
    await setSettings({ upiPending: { upiId: d.upiId, upiPayeeName: d.upiPayeeName, effectiveAt: effectiveAt.toISOString(), byAccountId: req.account!.id } }, req.account!.id)
    await audit(prisma, req, 'settings.upi_change_requested', 'Setting', 'upiId', { upiId: before.upiId, upiPayeeName: before.upiPayeeName }, { upiId: d.upiId, upiPayeeName: d.upiPayeeName, effectiveAt })
    await notifyAdmins('admin_alert', { title: 'Payment UPI ID is changing', text: `${req.account!.name} changed the studio UPI ID from ${before.upiId ?? '(none)'} to ${d.upiId} (${d.upiPayeeName}). It goes live at ${effectiveAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}. If this was not expected, the owner can cancel it in Settings now.` }, `upi:${lc.id}`)
    await getSettings() // applies immediately when there is no delay
    res.json({ ok: true, effectiveAt })
  }),
)

adminRouter.post(
  '/settings/upi/cancel',
  ownerOnly,
  h(async (req, res) => {
    const s = await getSettings()
    if (!s.upiPending) throw notFound('No pending UPI change')
    await setSettings({ upiPending: null }, req.account!.id)
    await audit(prisma, req, 'settings.upi_change_cancelled', 'Setting', 'upiId', s.upiPending, null)
    res.json({ ok: true })
  }),
)

// ---------- Leads (LEAD-3, LEAD-4) ----------

adminRouter.get(
  '/leads',
  h(async (req, res) => {
    const q = parse(z.object({ status: z.enum(['OPEN', 'ALL', 'NEW', 'TRIAL_BOOKED', 'ATTENDED', 'JOINED', 'LOST']).default('OPEN') }), req.query)
    const where = q.status === 'ALL' ? {} : q.status === 'OPEN' ? { status: { in: ['NEW', 'TRIAL_BOOKED', 'ATTENDED'] as ('NEW' | 'TRIAL_BOOKED' | 'ATTENDED')[] } } : { status: q.status }
    const leads = await prisma.lead.findMany({ where, orderBy: [{ followUpOn: 'asc' }, { createdAt: 'desc' }], take: 300 })
    const bySource = await prisma.lead.groupBy({ by: ['source', 'status'], _count: { _all: true } })
    res.json({ leads: leads.map((l) => ({ ...l, followUpOn: l.followUpOn ? dbDay(l.followUpOn) : null })), funnel: bySource.map((r) => ({ source: r.source, status: r.status, count: r._count._all })) })
  }),
)

adminRouter.patch(
  '/leads/:id',
  h(async (req, res) => {
    const d = parse(z.object({ status: z.enum(['NEW', 'TRIAL_BOOKED', 'ATTENDED', 'JOINED', 'LOST']).optional(), followUpOn: dayStr.nullable().optional(), notes: z.string().max(2000).optional() }), req.body)
    await prisma.lead.update({ where: { id: String(req.params.id) }, data: { status: d.status, notes: d.notes, followUpOn: d.followUpOn === undefined ? undefined : d.followUpOn ? toDbDate(d.followUpOn) : null } })
    res.json({ ok: true })
  }),
)

// Book a lead's free trial (LEAD-2): creates or reuses their account and a TRIAL booking
adminRouter.post(
  '/leads/:id/trial',
  h(async (req, res) => {
    const d = parse(z.object({ classId: z.string(), email: z.string().trim().toLowerCase().email(), childName: z.string().trim().min(2).max(80).optional(), childDob: dayStr.optional() }), req.body)
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: String(req.params.id) } })
    const usedTrial = await prisma.booking.count({ where: { status: 'TRIAL', profile: { guardians: { some: { account: { phone: lead.phone } } } } } })
    if (usedTrial) throw conflict('This phone number has already had a free trial')
    const cls = await prisma.class.findUniqueOrThrow({ where: { id: d.classId }, include: { program: true } })
    const result = await prisma.$transaction(async (tx) => {
      let acc = await tx.account.findFirst({ where: { OR: [{ phone: lead.phone }, { email: d.email }] } })
      acc ??= await tx.account.create({ data: { name: lead.name, email: d.email, phone: lead.phone, roles: { create: [{ role: 'MEMBER' }] } } })
      const wantChild = cls.program.audience === 'KIDS'
      if (wantChild && (!d.childName || !d.childDob)) throw badRequest("Add the child's name and date of birth for a kids trial")
      let profile = await tx.profile.findFirst({ where: { guardians: { some: { accountId: acc.id } }, kind: wantChild ? 'CHILD' : 'ADULT', ...(wantChild ? { name: d.childName } : {}) } })
      if (!profile) {
        profile = await tx.profile.create({ data: { name: wantChild ? d.childName! : lead.name, dob: toDbDate(wantChild ? d.childDob! : '1990-01-01'), kind: wantChild ? 'CHILD' : 'ADULT' } })
        await tx.guardian.create({ data: { accountId: acc.id, profileId: profile.id } })
      }
      await tx.$queryRaw`SELECT id FROM \`Class\` WHERE id = ${cls.id} FOR UPDATE`
      const taken = await tx.booking.count({ where: { classId: cls.id, status: { in: ['BOOKED', 'TRIAL'] } } })
      if (taken >= cls.capacity) throw conflict('This class is full')
      const b = await tx.booking.upsert({ where: { classId_profileId: { classId: cls.id, profileId: profile.id } }, update: { status: 'TRIAL' }, create: { classId: cls.id, profileId: profile.id, status: 'TRIAL' } })
      await tx.lead.update({ where: { id: lead.id }, data: { status: 'TRIAL_BOOKED', trialBookingId: b.id } })
      return { acc, profile, b }
    })
    await sendMessage({ accountId: result.acc.id, template: 'booking_confirmed', data: { profile: result.profile.name, title: `${cls.title} (free trial)`, when: cls.startsAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }), where: cls.mode === 'OFFLINE' ? cls.locationOrLink : 'Log in to the app to see the join link.' }, dedupeKey: `trial:${result.b.id}` })
    await audit(prisma, req, 'lead.trial_booked', 'Lead', lead.id, null, { classId: cls.id })
    res.status(201).json({ ok: true, note: result.profile.kind === 'ADULT' ? 'Ask the member to add their date of birth and accept the documents when they first log in.' : undefined })
  }),
)

// ---------- Logs and reports ----------

adminRouter.get(
  '/audit',
  h(async (req, res) => {
    const q = parse(z.object({ action: z.string().max(60).optional(), take: z.coerce.number().int().min(1).max(500).default(200) }), req.query)
    const rows = await prisma.auditLog.findMany({ where: q.action ? { action: { startsWith: q.action } } : {}, orderBy: { at: 'desc' }, take: q.take })
    const actors = await prisma.account.findMany({ where: { id: { in: rows.map((r) => r.actorId).filter(Boolean) as string[] } }, select: { id: true, name: true } })
    res.json({ audit: rows.map((r) => ({ ...r, actor: actors.find((a) => a.id === r.actorId)?.name ?? null })) })
  }),
)

adminRouter.get(
  '/messages',
  h(async (_req, res) => {
    const rows = await prisma.messageLog.findMany({ orderBy: { createdAt: 'desc' }, take: 300, include: { account: { select: { name: true, email: true } } } })
    res.json({ messages: rows.map((m) => ({ id: m.id, to: m.account?.email ?? '', name: m.account?.name ?? '', template: m.template, channel: m.channel, status: m.status, attempts: m.attempts, error: m.error, at: m.sentAt ?? m.createdAt })) })
  }),
)

// ADM-5, ADM-6
adminRouter.get(
  '/reports',
  h(async (req, res) => {
    const q = parse(z.object({ from: dayStr, to: dayStr, mode: z.enum(['ALL', 'ONLINE', 'OFFLINE']).default('ALL') }), req.query)
    const range = { gte: istInstant(q.from, '00:00'), lt: istInstant(addDays(q.to, 1), '00:00') }
    const modeFilter = q.mode === 'ALL' ? {} : { mode: q.mode }
    const classes = await prisma.class.findMany({
      where: { startsAt: range, status: { not: 'CANCELLED' }, ...modeFilter },
      include: { program: true, coach: { select: { name: true } }, bookings: { select: { status: true } }, _count: { select: { attendance: true } } },
    })
    const byProgram = new Map<string, { classes: number; booked: number; attended: number; noShows: number }>()
    const byCoach = new Map<string, { classes: number; attended: number }>()
    for (const c of classes) {
      const p = byProgram.get(c.program.name) ?? { classes: 0, booked: 0, attended: 0, noShows: 0 }
      p.classes++
      p.booked += c.bookings.filter((b) => b.status !== 'CANCELLED').length
      p.attended += c._count.attendance
      p.noShows += c.bookings.filter((b) => b.status === 'NO_SHOW').length
      byProgram.set(c.program.name, p)
      const k = byCoach.get(c.coach.name) ?? { classes: 0, attended: 0 }
      k.classes++
      k.attended += c._count.attendance
      byCoach.set(c.coach.name, k)
    }
    const payments = await prisma.payment.findMany({ where: { status: 'VERIFIED', paidOn: { gte: toDbDate(q.from), lte: toDbDate(q.to) } }, include: { plan: true, membership: true } })
    const revenue = new Map<string, number>()
    for (const p of payments) revenue.set(p.plan.name, (revenue.get(p.plan.name) ?? 0) + p.amountPaise)
    const firstPayments = await prisma.payment.groupBy({ by: ['profileId'], where: { status: 'VERIFIED' }, _min: { paidOn: true } })
    const newMembers = firstPayments.filter((f) => f._min.paidOn && dbDay(f._min.paidOn) >= q.from && dbDay(f._min.paidOn) <= q.to).length
    res.json({
      attendance: [...byProgram.entries()].map(([program, v]) => ({ program, ...v })),
      coaches: [...byCoach.entries()].map(([coach, v]) => ({ coach, ...v, avgAttendance: v.classes ? +(v.attended / v.classes).toFixed(1) : 0 })),
      revenue: [...revenue.entries()].map(([plan, paise]) => ({ plan, paise })),
      totals: { revenuePaise: payments.reduce((s, p) => s + p.amountPaise, 0), payments: payments.length, newMembers, renewals: payments.length - newMembers },
    })
  }),
)

// ---------- Import existing members (MIG-1 to MIG-4) ----------

const importRow = z.object({
  holderName: z.string().trim().min(2),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().regex(/^[6-9]\d{9}$/),
  profileName: z.string().trim().min(2),
  dob: dayStr,
  plan: z.string().trim(),
  paidUntil: dayStr,
  notes: z.string().optional(),
})

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"' && text[i + 1] === '"') (cell += '"'), i++
      else if (ch === '"') q = false
      else cell += ch
    } else if (ch === '"') q = true
    else if (ch === ',') row.push(cell), (cell = '')
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      if (row.some((c) => c.trim())) rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  row.push(cell)
  if (row.some((c) => c.trim())) rows.push(row)
  const [head, ...body] = rows
  const keys = (head ?? []).map((k) => k.trim())
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])))
}

adminRouter.post(
  '/import',
  h(async (req, res) => {
    const { csv, commit } = parse(z.object({ csv: z.string().max(2_000_000), commit: z.boolean().default(false) }), req.body)
    const plans = await prisma.plan.findMany()
    const rows = parseCsv(csv)
    const checked = rows.map((r, i) => {
      const p = importRow.safeParse(r)
      if (!p.success) return { line: i + 2, ok: false as const, error: p.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join('; '), row: r }
      const plan = plans.find((x) => x.shortCode === p.data.plan.toUpperCase() || x.name.toLowerCase() === p.data.plan.toLowerCase())
      if (!plan) return { line: i + 2, ok: false as const, error: `Unknown plan "${p.data.plan}"`, row: r }
      return { line: i + 2, ok: true as const, data: p.data, planId: plan.id, cycleMonths: plan.cycleMonths }
    })
    const errors = checked.filter((c) => !c.ok)
    if (!commit || errors.length) return void res.json({ preview: true, total: checked.length, valid: checked.length - errors.length, errors })
    let created = 0
    for (const c of checked) {
      if (!c.ok) continue
      const d = c.data
      await prisma.$transaction(async (tx) => {
        let acc = await tx.account.findFirst({ where: { OR: [{ email: d.email }, { phone: d.phone }] } })
        acc ??= await tx.account.create({ data: { name: d.holderName, email: d.email, phone: d.phone, roles: { create: [{ role: 'MEMBER' }] } } })
        const [y, m, dd] = d.dob.split('-').map(Number)
        const t = todayIst().split('-').map(Number)
        const age = t[0] - y - (t[1] < m || (t[1] === m && t[2] < dd) ? 1 : 0)
        const profile = await tx.profile.create({ data: { name: d.profileName, dob: toDbDate(d.dob), kind: age < 18 ? 'CHILD' : 'ADULT', emergencyNote: d.notes || null } })
        await tx.guardian.create({ data: { accountId: acc.id, profileId: profile.id } })
        // Opening membership: one cycle ending on the paid-until date (MIG-3)
        const start = addDays(addMonthsClamped(d.paidUntil, -c.cycleMonths), 1) as Day
        await tx.membership.create({ data: { profileId: profile.id, planId: c.planId, startDate: toDbDate(start), endDate: toDbDate(d.paidUntil), status: 'ACTIVE', source: 'IMPORTED' } })
      })
      created++
    }
    // MIG-4: everyone imported gets an invite to log in and accept the documents
    const accounts = await prisma.account.findMany({ where: { email: { in: checked.filter((c) => c.ok).map((c) => (c.ok ? c.data.email : '')) } } })
    for (const a of accounts) await sendMessage({ accountId: a.id, template: 'welcome', data: { name: a.name, code: 'in the app' }, dedupeKey: `import-invite:${a.id}` })
    await audit(prisma, req, 'import.members', 'Profile', null, null, { created, docs: DOC_VERSIONS })
    res.json({ imported: created })
  }),
)
