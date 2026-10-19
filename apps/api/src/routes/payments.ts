// Member Pay screen and admin payment tools (PAY-1 to PAY-17, BILL-1 to BILL-6)
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db'
import { audit } from '../lib/audit'
import { assertProfileAccess, isAdmin, ownProfileIds, requireAdmin, requireAuth } from '../lib/auth'
import { fmtDay, rupees } from '../lib/format'
import { badRequest, conflict, forbidden, h, notFound, parse } from '../lib/http'
import { sendMessage } from '../lib/messages'
import { getSettings } from '../lib/settings'
import { dbDay, todayIst, toDbDate } from '../lib/time'
import { buildUpiLink, memberCode, normaliseUtr, upiNote } from '../domain/upi'
import { nextPeriod, profilePlans } from '../services/memberships'
import { reversePayment, rejectPayment, verifyPayment } from '../services/payments'

export const paymentsRouter = Router()
paymentsRouter.use(requireAuth)

const UPLOAD_DIR = path.resolve(import.meta.dirname, '../../../../.data/uploads')

// What a profile can pay for, with a ready UPI link per plan (PAY-4 to PAY-7)
paymentsRouter.get(
  '/options/:profileId',
  h(async (req, res) => {
    const profileId = String(req.params.profileId)
    await assertProfileAccess(req, profileId)
    const settings = await getSettings()
    const profile = await prisma.profile.findUniqueOrThrow({ where: { id: profileId } })
    const audience = profile.kind === 'CHILD' ? 'KIDS' : 'ADULTS'
    const plans = await prisma.plan.findMany({ where: { active: true, audience: { in: [audience, 'MIXED'] } }, include: { programs: { include: { program: true } } }, orderBy: { pricePaise: 'asc' } })
    const current = await profilePlans(profileId, settings.graceDays)
    const pending = await prisma.payment.findMany({ where: { profileId, status: 'PENDING' }, include: { plan: true } })
    const today = todayIst()
    const options = []
    for (const p of plans) {
      const period = await nextPeriod(prisma, profileId, p.id, today, settings.graceDays)
      const note = upiNote([profile.memberNo], p.shortCode, Number(period.start.slice(5, 7)))
      options.push({
        planId: p.id,
        name: p.name,
        pricePaise: p.pricePaise,
        programs: p.programs.map((x) => x.program.name),
        creditsPerCycle: p.creditsPerCycle,
        weeklyCap: p.weeklyCap,
        nextStart: period.start,
        nextEnd: period.end,
        note,
        upiLink: settings.upiId && settings.upiPayeeName ? buildUpiLink({ upiId: settings.upiId, payeeName: settings.upiPayeeName, amountPaise: p.pricePaise, note }) : null,
      })
    }
    // Current plan first (PAY-5)
    options.sort((a, b) => Number(current.some((c) => c.planId === b.planId)) - Number(current.some((c) => c.planId === a.planId)))
    res.json({
      profile: { id: profile.id, name: profile.name, memberCode: memberCode(profile.memberNo), kind: profile.kind },
      upi: settings.upiId ? { upiId: settings.upiId, payeeName: settings.upiPayeeName } : null,
      current,
      pending: pending.map((p) => ({ id: p.id, plan: p.plan.name, amountPaise: p.amountPaise, utr: p.utr, createdAt: p.createdAt })),
      options,
    })
  }),
)

// "I have paid" (PAY-8) for one or several profiles in one UPI payment (PAY-9)
paymentsRouter.post(
  '/submit',
  h(async (req, res) => {
    const d = parse(
      z.object({
        items: z.array(z.object({ profileId: z.string(), planId: z.string() })).min(1).max(6),
        utr: z.string().max(20),
        screenshot: z.string().max(2_900_000).optional(), // data URL, about 2 MB
      }),
      req.body,
    )
    const utr = normaliseUtr(d.utr)
    if (!utr) throw badRequest('The UPI reference (UTR) is 12 digits')
    for (const it of d.items) await assertProfileAccess(req, it.profileId)
    if (await prisma.payment.findFirst({ where: { utr } })) throw conflict('This UTR has already been used. Check the number or contact the studio.', 'UTR_USED')
    let proofFile: string | null = null
    if (d.screenshot) {
      const m = /^data:image\/(png|jpeg|webp);base64,(.+)$/.exec(d.screenshot)
      if (!m) throw badRequest('The screenshot must be a PNG, JPG or WebP image')
      const buf = Buffer.from(m[2], 'base64')
      if (buf.length > 2 * 1024 * 1024) throw badRequest('The screenshot must be under 2 MB')
      fs.mkdirSync(UPLOAD_DIR, { recursive: true })
      proofFile = `${randomUUID()}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`
      fs.writeFileSync(path.join(UPLOAD_DIR, proofFile), buf)
    }
    const batchId = d.items.length > 1 ? randomUUID() : null
    const profiles = await prisma.profile.findMany({ where: { id: { in: d.items.map((i) => i.profileId) } } })
    const plans = await prisma.plan.findMany({ where: { id: { in: d.items.map((i) => i.planId) } } })
    const note = upiNote(profiles.map((p) => p.memberNo), plans[0]?.shortCode ?? '', Number(todayIst().slice(5, 7)))
    const created = []
    for (const [i, it] of d.items.entries()) {
      const plan = plans.find((p) => p.id === it.planId)
      if (!plan) throw badRequest('Unknown plan')
      created.push(
        await prisma.payment.create({
          data: { profileId: it.profileId, planId: plan.id, amountPaise: plan.pricePaise, utr: i === 0 ? utr : null, upiNote: note, proofFile, batchId, paidOn: toDbDate(todayIst()), status: 'PENDING' },
        }),
      )
    }
    const total = created.reduce((s, p) => s + p.amountPaise, 0)
    await sendMessage({ accountId: req.account!.id, template: 'payment_pending', data: { utr, amount: rupees(total) }, dedupeKey: `pending:${created[0].id}` })
    res.status(201).json({ ok: true, ids: created.map((c) => c.id) })
  }),
)

paymentsRouter.get(
  '/history/:profileId',
  h(async (req, res) => {
    const profileId = String(req.params.profileId)
    await assertProfileAccess(req, profileId)
    const rows = await prisma.payment.findMany({ where: { profileId }, include: { plan: true, receipts: true, membership: true }, orderBy: { createdAt: 'desc' } })
    res.json({
      payments: rows.map((p) => ({
        id: p.id, plan: p.plan.name, amountPaise: p.amountPaise, status: p.status, utr: p.utr, paidOn: dbDay(p.paidOn), reason: p.reason,
        period: p.membership ? { start: dbDay(p.membership.startDate), end: dbDay(p.membership.endDate) } : null,
        receipts: p.receipts.map((r) => ({ number: r.number, kind: r.kind })),
      })),
    })
  }),
)

// Printable receipt or credit note (BILL-2, BILL-4). Members see their own; admins see all.
paymentsRouter.get(
  '/receipts/:number',
  h(async (req, res) => {
    const r = await prisma.receipt.findUnique({ where: { number: String(req.params.number) }, include: { payment: { include: { profile: true, plan: true, membership: true } } } })
    if (!r) throw notFound('Receipt not found')
    if (!isAdmin(req.account!.roles) && !(await ownProfileIds(req.account!.id)).includes(r.payment.profileId)) throw forbidden()
    const s = await getSettings()
    const p = r.payment
    const gst = r.gstJson as { gstNumber: string; ratePercent: number } | null
    const esc = (v: string) => v.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
    const title = r.kind === 'RECEIPT' ? (gst ? 'Tax Invoice' : 'Receipt') : 'Credit Note'
    const taxLine = gst ? `<tr><td>GST (${gst.ratePercent}%, included)</td><td>${rupees(Math.round((p.amountPaise * gst.ratePercent) / (100 + gst.ratePercent)))}</td></tr><tr><td>GSTIN</td><td>${esc(gst.gstNumber)}</td></tr>` : ''
    res.type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title} ${esc(r.number)}</title><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:Segoe UI,Roboto,Arial,sans-serif;color:#12335F;background:#F5F7FB;margin:0;padding:24px}main{max-width:620px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(11,31,63,.1)}header{background:#0B1F3F;color:#fff;padding:24px 28px;display:flex;justify-content:space-between;align-items:center}.w{font:800 italic 26px Poppins,Arial,sans-serif}.w b{color:#4AA82A}.w i{color:#9FB4D3;font-style:inherit}section{padding:28px}h1{margin:0 0 4px;font-size:22px}table{width:100%;border-collapse:collapse;margin-top:18px}td{padding:10px 0;border-bottom:1px solid #D9E1EC}td:last-child{text-align:right;font-weight:600}.total td{font-size:18px;border:0}footer{padding:16px 28px;background:#EAF0F8;font-size:12px;letter-spacing:.2em;color:#4A5D78}button{margin:16px auto;display:block;padding:12px 22px;border-radius:999px;border:0;background:#2E7D1A;color:#fff;font-weight:600;cursor:pointer}@media print{button{display:none}body{background:#fff;padding:0}main{box-shadow:none}}</style></head>
<body><main><header><span class="w">uni<b>fit</b><i>.hyd</i></span><span>${title}</span></header><section>
<h1>${title} ${esc(r.number)}</h1><div>${esc(s.studioName)} · Issued ${fmtDay(dbDay(r.issuedAt))}</div>
${r.refersTo ? `<p>Cancels receipt ${esc(r.refersTo)}. Reason: ${esc(p.reason ?? '')}</p>` : ''}
<table><tr><td>Member</td><td>${esc(p.profile.name)} (${memberCode(p.profile.memberNo)})</td></tr>
<tr><td>Plan</td><td>${esc(p.plan.name)}</td></tr>
${p.membership ? `<tr><td>Period</td><td>${fmtDay(dbDay(p.membership.startDate))} to ${fmtDay(dbDay(p.membership.endDate))}</td></tr>` : ''}
<tr><td>Paid on</td><td>${fmtDay(dbDay(p.paidOn))}</td></tr><tr><td>Method</td><td>${p.method}${p.utr ? ` · UTR ${esc(p.utr)}` : ''}</td></tr>
${taxLine}<tr class="total"><td>${r.kind === 'RECEIPT' ? 'Amount received' : 'Amount credited'}</td><td>${rupees(p.amountPaise)}</td></tr></table>
</section><footer>TRAIN • TRANSFORM • THRIVE</footer></main><button onclick="print()">Print or save as PDF</button></body></html>`)
  }),
)

// ---------- Admin ----------

paymentsRouter.get(
  '/pending',
  requireAdmin,
  h(async (_req, res) => {
    const rows = await prisma.payment.findMany({ where: { status: 'PENDING' }, include: { profile: true, plan: true }, orderBy: { createdAt: 'asc' } })
    res.json({
      payments: rows.map((p) => ({
        id: p.id, batchId: p.batchId, profileId: p.profileId, member: p.profile.name, memberCode: memberCode(p.profile.memberNo), plan: p.plan.name,
        amountPaise: p.amountPaise, planPricePaise: p.plan.pricePaise, utr: p.utr, note: p.upiNote, hasProof: !!p.proofFile, createdAt: p.createdAt,
      })),
    })
  }),
)

paymentsRouter.get(
  '/:id/proof',
  requireAdmin,
  h(async (req, res) => {
    const p = await prisma.payment.findUnique({ where: { id: String(req.params.id) } })
    if (!p?.proofFile) throw notFound('No screenshot')
    res.sendFile(path.join(UPLOAD_DIR, path.basename(p.proofFile)))
  }),
)

paymentsRouter.post(
  '/:id/verify',
  requireAdmin,
  h(async (req, res) => {
    res.json(await verifyPayment(req, String(req.params.id)))
  }),
)

paymentsRouter.post(
  '/:id/reject',
  requireAdmin,
  h(async (req, res) => {
    const { reason } = parse(z.object({ reason: z.string().trim().min(3, 'Add a reason').max(300) }), req.body)
    await rejectPayment(req, String(req.params.id), reason)
    res.json({ ok: true })
  }),
)

// Record a payment directly: cash, or UPI without a member submission (PAY-11, PAY-13)
paymentsRouter.post(
  '/record',
  requireAdmin,
  h(async (req, res) => {
    const d = parse(
      z.object({
        profileId: z.string(),
        planId: z.string(),
        amountPaise: z.number().int().positive(),
        paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        method: z.enum(['UPI', 'CASH']),
        utr: z.string().optional(),
        reason: z.string().trim().max(300).optional(),
      }),
      req.body,
    )
    const plan = await prisma.plan.findUniqueOrThrow({ where: { id: d.planId } })
    if (d.amountPaise !== plan.pricePaise && !d.reason) throw badRequest('The amount differs from the plan price. Add a reason (for example a discount).')
    if (d.amountPaise < plan.pricePaise * 0.5) throw badRequest('Part payments do not start a membership. Record the payment once the full amount is received.')
    const utr = d.utr ? normaliseUtr(d.utr) : null
    if (d.utr && !utr) throw badRequest('The UTR is 12 digits')
    if (utr && (await prisma.payment.findFirst({ where: { utr } }))) throw conflict('This UTR has already been used', 'UTR_USED')
    if (d.paidOn > todayIst()) throw badRequest('The payment date cannot be in the future')
    const p = await prisma.payment.create({ data: { profileId: d.profileId, planId: d.planId, amountPaise: d.amountPaise, method: d.method, utr, paidOn: toDbDate(d.paidOn), reason: d.reason, status: 'PENDING' } })
    await audit(prisma, req, 'payment.recorded', 'Payment', p.id, null, d)
    res.status(201).json(await verifyPayment(req, p.id))
  }),
)

paymentsRouter.post(
  '/:id/reverse',
  requireAdmin,
  h(async (req, res) => {
    const d = parse(
      z.object({ reason: z.string().trim().min(3, 'Add a reason').max(300), refund: z.object({ amountPaise: z.number().int().positive(), method: z.enum(['UPI', 'CASH', 'BANK']) }).optional() }),
      req.body,
    )
    res.json(await reversePayment(req, String(req.params.id), d))
  }),
)

// Payments for a date range, JSON or CSV for the accountant (BILL-5, PAY-17 helper)
paymentsRouter.get(
  '/list',
  requireAdmin,
  h(async (req, res) => {
    const q = parse(z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), format: z.enum(['json', 'csv']).default('json') }), req.query)
    const rows = await prisma.payment.findMany({
      where: { paidOn: { gte: toDbDate(q.from), lte: toDbDate(q.to) } },
      include: { profile: true, plan: true, receipts: true },
      orderBy: { paidOn: 'asc' },
    })
    const data = rows.map((p) => ({
      paidOn: dbDay(p.paidOn), member: p.profile.name, memberCode: memberCode(p.profile.memberNo), plan: p.plan.name, amount: (p.amountPaise / 100).toFixed(2),
      method: p.method, utr: p.utr ?? '', status: p.status, receipts: p.receipts.map((r) => r.number).join(' '), note: p.upiNote ?? '', reason: p.reason ?? '',
    }))
    if (q.format === 'csv') {
      const cols = Object.keys(data[0] ?? { paidOn: '' }) as (keyof (typeof data)[number])[]
      const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
      res.setHeader('Content-Disposition', `attachment; filename="unifit-payments-${q.from}-to-${q.to}.csv"`)
      res.type('text/csv').send([cols.join(','), ...data.map((r) => cols.map((c) => cell(String(r[c]))).join(','))].join('\n'))
      return
    }
    res.json({ payments: data, totalPaise: rows.filter((p) => p.status === 'VERIFIED').reduce((s, p) => s + p.amountPaise, 0) })
  }),
)

