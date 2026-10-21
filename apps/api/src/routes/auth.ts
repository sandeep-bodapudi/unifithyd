// Registration and login (ACC-1 to ACC-6, KID-1, KID-2)
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { prisma } from '../db'
import { showCodes } from '../env'
import { audit } from '../lib/audit'
import { endSession, isStaff, requireAuth, startSession } from '../lib/auth'
import { hashCode, safeEqual, sixDigits, verifyPassword } from '../lib/crypto'
import { badRequest, conflict, h, HttpError, parse } from '../lib/http'
import { sendMessage } from '../lib/messages'
import { todayIst, toDbDate } from '../lib/time'
import { memberCode } from '../domain/upi'
import { addMonthsClamped } from '../domain/dates'

export const authRouter = Router()

export const DOC_VERSIONS = { TERMS: '2026-10', PRIVACY: '2026-10', WAIVER: '2026-10', REFUND: '2026-10' } as const

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false })
authRouter.use(limiter)

const email = z.string().trim().toLowerCase().email('Enter a valid email address')
const phone = z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number')
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date')

const registerInput = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(80),
  email,
  phone,
  dob: day.optional(), // the account holder trains too
  trainsSelf: z.boolean(),
  children: z.array(z.object({ name: z.string().trim().min(2).max(80), dob: day })).max(6).default([]),
  acceptTerms: z.literal(true, { message: 'Please accept the terms, privacy policy, waiver and refund policy' }),
})

function age(dob: string, today: string) {
  const [y, m, d] = dob.split('-').map(Number)
  const [ty, tm, td] = today.split('-').map(Number)
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0)
}

authRouter.post(
  '/register',
  h(async (req, res) => {
    const d = parse(registerInput, req.body)
    const today = todayIst()
    if (!d.trainsSelf && d.children.length === 0) throw badRequest('Add yourself or at least one child')
    if (d.trainsSelf) {
      if (!d.dob) throw badRequest('Enter your date of birth')
      if (age(d.dob, today) < 18) throw badRequest('Members under 18 must be added by a parent or guardian')
    }
    for (const c of d.children) {
      const a = age(c.dob, today)
      if (a >= 18 || a < 3) throw badRequest(`${c.name}: child profiles are for ages 3 to 17`)
    }
    const dup = await prisma.account.findFirst({ where: { OR: [{ email: d.email }, { phone: d.phone }] } })
    if (dup) throw conflict('An account with this email or phone already exists. Please log in instead.', 'DUPLICATE')

    const account = await prisma.$transaction(async (tx) => {
      const acc = await tx.account.create({ data: { email: d.email, phone: d.phone, name: d.name, roles: { create: [{ role: 'MEMBER' }] } } })
      const people = [...(d.trainsSelf ? [{ name: d.name, dob: d.dob!, kind: 'ADULT' as const }] : []), ...d.children.map((c) => ({ ...c, kind: 'CHILD' as const }))]
      for (const p of people) {
        const profile = await tx.profile.create({ data: { name: p.name, dob: toDbDate(p.dob), kind: p.kind } })
        await tx.guardian.create({ data: { accountId: acc.id, profileId: profile.id } })
        for (const [doc, version] of Object.entries(DOC_VERSIONS)) {
          await tx.consent.create({ data: { profileId: profile.id, acceptedById: acc.id, document: doc, version, ip: req.ip } })
        }
      }
      return acc
    })
    const first = await prisma.guardian.findFirst({ where: { accountId: account.id }, include: { profile: true } })
    await sendMessage({ accountId: account.id, template: 'welcome', data: { name: d.name, code: first ? memberCode(first.profile.memberNo) : '' }, dedupeKey: `welcome:${account.id}` })
    const sent = await issueCode(account.id, 'login')
    res.status(201).json({ ok: true, next: 'code', ...sent })
  }),
)

async function issueCode(accountId: string, purpose: 'login' | 'staff') {
  const hourAgo = new Date(Date.now() - 3600_000)
  const recent = await prisma.loginCode.count({ where: { accountId, createdAt: { gte: hourAgo } } })
  if (recent >= 5) throw new HttpError(429, 'TOO_MANY_CODES', 'Too many codes requested. Please wait an hour and try again.')
  const code = sixDigits()
  const row = await prisma.loginCode.create({
    data: { accountId, channel: 'EMAIL', purpose, codeHash: hashCode(accountId, code), expiresAt: new Date(Date.now() + 10 * 60_000) },
  })
  await sendMessage({ accountId, template: 'login_code', data: { code }, dedupeKey: `code:${row.id}` })
  return showCodes ? { devCode: code } : {}
}

authRouter.post(
  '/request-code',
  h(async (req, res) => {
    const { email: e } = parse(z.object({ email }), req.body)
    const acc = await prisma.account.findUnique({ where: { email: e }, include: { roles: true } })
    // Same answer whether or not the account exists, so emails cannot be probed
    if (!acc || acc.disabled) return void res.json({ ok: true, next: 'code' })
    if (isStaff(acc.roles.map((r) => r.role))) return void res.json({ ok: true, next: 'password' })
    res.json({ ok: true, next: 'code', ...(await issueCode(acc.id, 'login')) })
  }),
)

authRouter.post(
  '/staff-password',
  h(async (req, res) => {
    const d = parse(z.object({ email, password: z.string().min(1).max(200) }), req.body)
    const acc = await prisma.account.findUnique({ where: { email: d.email }, include: { roles: true } })
    const ok = acc && !acc.disabled && (await verifyPassword(d.password, acc.passwordHash))
    if (!ok) {
      await audit(prisma, req, 'login.password_failed', 'Account', acc?.id ?? null, null, { email: d.email })
      throw new HttpError(401, 'BAD_LOGIN', 'Email or password is not right')
    }
    res.json({ ok: true, next: 'code', ...(await issueCode(acc.id, 'staff')) })
  }),
)

authRouter.post(
  '/verify-code',
  h(async (req, res) => {
    const d = parse(z.object({ email, code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code') }), req.body)
    const acc = await prisma.account.findUnique({ where: { email: d.email }, include: { roles: true } })
    const fail = () => new HttpError(401, 'BAD_CODE', 'That code is not right or has expired')
    if (!acc || acc.disabled) throw fail()
    const roles = acc.roles.map((r) => r.role)
    const lc = await prisma.loginCode.findFirst({ where: { accountId: acc.id, usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' } })
    if (!lc || lc.attempts >= 5) throw fail()
    // Staff must have passed the password step for this code (two-step login)
    if (isStaff(roles) && lc.purpose !== 'staff') throw fail()
    if (!safeEqual(lc.codeHash, hashCode(acc.id, d.code))) {
      await prisma.loginCode.update({ where: { id: lc.id }, data: { attempts: { increment: 1 } } })
      throw fail()
    }
    await prisma.loginCode.update({ where: { id: lc.id }, data: { usedAt: new Date() } })
    await startSession(res, acc.id, roles, req.get('user-agent'))
    await audit(prisma, null, 'login', 'Account', acc.id)
    res.json({ ok: true })
  }),
)

authRouter.post(
  '/logout',
  h(async (req, res) => {
    await endSession(req, res)
    res.json({ ok: true })
  }),
)

authRouter.get(
  '/me',
  requireAuth,
  h(async (req, res) => {
    const acc = await prisma.account.findUniqueOrThrow({
      where: { id: req.account!.id },
      include: { guardianships: { include: { profile: true } }, coachPrograms: { select: { id: true, name: true } } },
    })
    res.json({
      account: { id: acc.id, name: acc.name, email: acc.email, phone: acc.phone, roles: req.account!.roles, channelPref: acc.channelPref },
      profiles: await Promise.all(acc.guardianships.map(async (g) => ({
        id: g.profile.id,
        name: g.profile.name,
        kind: g.profile.kind,
        memberCode: memberCode(g.profile.memberNo),
        dob: g.profile.dob.toISOString().slice(0, 10),
        needsConsent: (await prisma.consent.count({ where: { profileId: g.profile.id, document: { in: Object.keys(DOC_VERSIONS) }, version: { in: Object.values(DOC_VERSIONS) } } })) < Object.keys(DOC_VERSIONS).length,
      }))),
      coachPrograms: acc.coachPrograms,
    })
  }),
)

// Add a child to an existing account (KID-1, KID-2)
authRouter.post(
  '/children',
  requireAuth,
  h(async (req, res) => {
    const d = parse(z.object({ name: z.string().trim().min(2).max(80), dob: day, acceptTerms: z.literal(true, { message: 'Please accept the documents for this child' }) }), req.body)
    const a = age(d.dob, todayIst())
    if (a >= 18 || a < 3) throw badRequest('Child profiles are for ages 3 to 17')
    const profile = await prisma.$transaction(async (tx) => {
      const p = await tx.profile.create({ data: { name: d.name, dob: toDbDate(d.dob), kind: 'CHILD' } })
      await tx.guardian.create({ data: { accountId: req.account!.id, profileId: p.id } })
      for (const [doc, version] of Object.entries(DOC_VERSIONS)) await tx.consent.create({ data: { profileId: p.id, acceptedById: req.account!.id, document: doc, version, ip: req.ip } })
      return p
    })
    res.status(201).json({ id: profile.id, memberCode: memberCode(profile.memberNo) })
  }),
)

// Account holder starts training too (adds an adult profile)
authRouter.post(
  '/self-profile',
  requireAuth,
  h(async (req, res) => {
    const d = parse(z.object({ dob: day, acceptTerms: z.literal(true, { message: 'Please accept the documents' }) }), req.body)
    if (age(d.dob, todayIst()) < 18) throw badRequest('You must be 18 or older')
    const own = await prisma.guardian.findFirst({ where: { accountId: req.account!.id, profile: { kind: 'ADULT' } } })
    if (own) throw conflict('You already have your own profile')
    const p = await prisma.$transaction(async (tx) => {
      const p = await tx.profile.create({ data: { name: req.account!.name, dob: toDbDate(d.dob), kind: 'ADULT' } })
      await tx.guardian.create({ data: { accountId: req.account!.id, profileId: p.id } })
      for (const [doc, version] of Object.entries(DOC_VERSIONS)) await tx.consent.create({ data: { profileId: p.id, acceptedById: req.account!.id, document: doc, version, ip: req.ip } })
      return p
    })
    res.status(201).json({ id: p.id })
  }),
)

authRouter.patch(
  '/me',
  requireAuth,
  h(async (req, res) => {
    const d = parse(z.object({ name: z.string().trim().min(2).max(80).optional(), channelPref: z.enum(['EMAIL', 'WHATSAPP', 'SMS']).optional() }), req.body)
    await prisma.account.update({ where: { id: req.account!.id }, data: d })
    res.json({ ok: true })
  }),
)

// ACC-7: download own data
authRouter.get(
  '/export',
  requireAuth,
  h(async (req, res) => {
    const acc = await prisma.account.findUniqueOrThrow({
      where: { id: req.account!.id },
      select: {
        name: true, email: true, phone: true, createdAt: true,
        guardianships: { select: { profile: { select: { name: true, dob: true, kind: true, memberNo: true, memberships: true, bookings: true, attendance: true, payments: { select: { amountPaise: true, utr: true, status: true, paidOn: true } }, weights: true, consents: true } } } },
      },
    })
    res.setHeader('Content-Disposition', 'attachment; filename="unifit-my-data.json"')
    res.json(acc)
  }),
)

// ACC-7: deletion request is logged for the admin to action within 30 days
authRouter.post(
  '/delete-request',
  requireAuth,
  h(async (req, res) => {
    await audit(prisma, req, 'privacy.deletion_requested', 'Account', req.account!.id, null, { requestedOn: todayIst(), dueBy: addMonthsClamped(todayIst(), 1) })
    res.json({ ok: true })
  }),
)

// Accept the current documents for profiles that have not (imports, new versions) (ACC-5, MIG-4)
authRouter.post(
  '/accept-documents',
  requireAuth,
  h(async (req, res) => {
    const d = parse(z.object({ profileIds: z.array(z.string()).min(1), dob: day.optional(), acceptTerms: z.literal(true, { message: 'Please accept the documents' }) }), req.body)
    const mine = (await prisma.guardian.findMany({ where: { accountId: req.account!.id } })).map((g) => g.profileId)
    for (const pid of d.profileIds) {
      if (!mine.includes(pid)) throw badRequest('Profile not on your account')
      for (const [doc, version] of Object.entries(DOC_VERSIONS)) await prisma.consent.create({ data: { profileId: pid, acceptedById: req.account!.id, document: doc, version, ip: req.ip } })
    }
    res.json({ ok: true })
  }),
)
