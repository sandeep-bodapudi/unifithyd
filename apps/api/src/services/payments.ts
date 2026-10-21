// Verify, record, reverse and refund payments; receipts and credit notes (PAY-10 to PAY-14, BILL-1 to BILL-6)
import type { Request } from 'express'
import { lockRow, prisma } from '../db'
import { addDays } from '../domain/dates'
import type { Prisma } from '../generated/prisma/client'
import { audit } from '../lib/audit'
import { fmtDay, rupees } from '../lib/format'
import { conflict, notFound } from '../lib/http'
import { sendMessage } from '../lib/messages'
import { getSettings } from '../lib/settings'
import { dbDay, todayIst, toDbDate } from '../lib/time'
import { nextPeriod, rechainRun, runContaining } from './memberships'

type Tx = Prisma.TransactionClient

/** Next number from a gap-free yearly counter, inside the caller's transaction */
async function nextNumber(tx: Tx, prefix: 'UF' | 'UF-CN') {
  const year = todayIst().slice(0, 4)
  const key = `${prefix}-${year}`
  const c = await tx.counter.upsert({ where: { key }, create: { key, value: 1 }, update: { value: { increment: 1 } } })
  return `${prefix}-${year}-${String(c.value).padStart(4, '0')}`
}

async function gstJson() {
  const s = await getSettings()
  return s.gstEnabled ? { gstNumber: s.gstNumber, ratePercent: s.gstRatePercent, inclusive: true } : undefined
}

/** Turns a pending (or new) payment into a membership period and a receipt (PAY-12) */
export async function verifyPayment(req: Request, paymentId: string) {
  const settings = await getSettings()
  const gst = await gstJson()
  const out = await prisma.$transaction(async (tx) => {
    await lockRow(tx, 'Payment', paymentId)
    const p = await tx.payment.findUnique({ where: { id: paymentId }, include: { plan: true, profile: true } })
    if (!p) throw notFound('Payment not found')
    if (p.status !== 'PENDING') throw conflict(`This payment is already ${p.status.toLowerCase()}`)
    const period = await nextPeriod(tx, p.profileId, p.planId, dbDay(p.paidOn), settings.graceDays)
    const m = await tx.membership.create({
      data: { profileId: p.profileId, planId: p.planId, paymentId: p.id, startDate: toDbDate(period.start), endDate: toDbDate(period.end), status: 'ACTIVE' },
    })
    const number = await nextNumber(tx, 'UF')
    await tx.receipt.create({ data: { number, kind: 'RECEIPT', paymentId: p.id, gstJson: gst as never } })
    await tx.payment.update({ where: { id: p.id }, data: { status: 'VERIFIED', verifiedBy: req.account!.id } })
    await audit(tx, req, 'payment.verified', 'Payment', p.id, null, { receipt: number, period })
    return { p, m, number, period }
  })
  const owner = await prisma.guardian.findFirst({ where: { profileId: out.p.profileId }, orderBy: { createdAt: 'asc' } })
  if (owner) {
    await sendMessage({
      accountId: owner.accountId,
      template: 'payment_verified',
      data: { amount: rupees(out.p.amountPaise), plan: out.p.plan.name, profile: out.p.profile.name, until: fmtDay(out.period.end), receipt: out.number },
      dedupeKey: `paid:${out.p.id}`,
    })
  }
  return { receipt: out.number, start: out.period.start, end: out.period.end }
}

export async function rejectPayment(req: Request, paymentId: string, reason: string) {
  const p = await prisma.payment.findUnique({ where: { id: paymentId } })
  if (!p || p.status !== 'PENDING') throw notFound('Pending payment not found')
  await prisma.payment.update({ where: { id: p.id }, data: { status: 'REJECTED', reason, verifiedBy: req.account!.id, utr: null } }) // frees the UTR for a corrected submission
  await audit(prisma, req, 'payment.rejected', 'Payment', p.id, { utr: p.utr }, { reason })
  const owner = await prisma.guardian.findFirst({ where: { profileId: p.profileId }, orderBy: { createdAt: 'asc' } })
  if (owner) await sendMessage({ accountId: owner.accountId, template: 'payment_rejected', data: { utr: p.utr ?? '-', reason }, dedupeKey: `reject:${p.id}` })
}

/**
 * Reversal (wrong payment) or refund (7.5, PAY-14, BILL-6): cancels the period,
 * closes the gap in the chain, issues a credit note. Nothing is deleted.
 */
export async function reversePayment(req: Request, paymentId: string, opts: { reason: string; refund?: { amountPaise: number; method: string } }) {
  return prisma.$transaction(async (tx) => {
    const p = await tx.payment.findUnique({ where: { id: paymentId }, include: { membership: true, receipts: true } })
    if (!p || p.status !== 'VERIFIED') throw notFound('Only verified payments can be reversed')
    let flagged = 0
    if (p.membership) {
      const { run, anchor, months } = await runContaining(tx, p.membership.id)
      await tx.membership.update({ where: { id: p.membership.id }, data: { status: 'CANCELLED' } })
      const remaining = run.filter((r) => r.id !== p.membership!.id)
      if (remaining.length) await rechainRun(tx, remaining, anchor, months)
      // Future bookings no longer covered are flagged to the admin, not deleted (7.5)
      flagged = await tx.booking.count({ where: { membershipId: p.membership.id, status: 'BOOKED', class: { startsAt: { gt: new Date() } } } })
    }
    const original = p.receipts.find((r) => r.kind === 'RECEIPT')
    const number = await nextNumber(tx, 'UF-CN')
    await tx.receipt.create({ data: { number, kind: 'CREDIT_NOTE', paymentId: p.id, refersTo: original?.number ?? null } })
    await tx.payment.update({
      where: { id: p.id },
      data: { status: opts.refund ? 'REFUNDED' : 'REVERSED', reason: opts.refund ? `${opts.reason} (refund ${rupees(opts.refund.amountPaise)} by ${opts.refund.method})` : opts.reason },
    })
    await audit(tx, req, opts.refund ? 'payment.refunded' : 'payment.reversed', 'Payment', p.id, { status: p.status }, { reason: opts.reason, refund: opts.refund, creditNote: number, flaggedBookings: flagged })
    return { creditNote: number, flaggedBookings: flagged }
  })
}

/** Admin freeze (7.5): pushes the end date, later periods follow, bookings inside are cancelled with credits back */
export async function freezeMembership(req: Request, membershipId: string, startDay: string, days: number, reason: string) {
  const res = await prisma.$transaction(async (tx) => {
    const m = await tx.membership.findUnique({ where: { id: membershipId }, include: { freezes: true, profile: true, plan: true } })
    if (!m || m.status === 'CANCELLED') throw notFound('Membership not found')
    if (m.freezes.length) throw conflict('This membership has already used its freeze')
    if (startDay < dbDay(m.startDate) || startDay > dbDay(m.endDate)) throw conflict('The freeze must start inside the membership dates')
    await tx.freeze.create({ data: { membershipId: m.id, startDate: toDbDate(startDay), days, reason, byAccountId: req.account!.id } })
    const { run, anchor, months } = await runContaining(tx, m.id)
    const chain = await rechainRun(tx, run, anchor, months)
    const lastDay = addDays(startDay, days - 1)
    const inside = await tx.booking.findMany({ where: { membershipId: m.id, status: 'BOOKED', class: { startsAt: { gte: new Date(`${startDay}T00:00:00+05:30`), lt: new Date(`${addDays(lastDay, 1)}T00:00:00+05:30`) } } } })
    for (const b of inside) await tx.booking.update({ where: { id: b.id }, data: { status: 'CANCELLED', creditUsed: false, makeupUsed: false, cancelledAt: new Date() } })
    await audit(tx, req, 'membership.frozen', 'Membership', m.id, null, { startDay, days, reason, cancelledBookings: inside.length })
    return { m, newEnd: chain.find((c) => c.id === m.id)!.end }
  })
  const owner = await prisma.guardian.findFirst({ where: { profileId: res.m.profileId }, orderBy: { createdAt: 'asc' } })
  if (owner) await sendMessage({ accountId: owner.accountId, template: 'freeze_applied', data: { profile: res.m.profile.name, days, from: fmtDay(startDay), until: fmtDay(res.newEnd) }, dedupeKey: `freeze:${res.m.id}` })
  return { newEnd: res.newEnd }
}
