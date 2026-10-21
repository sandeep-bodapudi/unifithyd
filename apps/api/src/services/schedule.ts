// Series generation, bookings and studio cancellations (CLS-5 to CLS-8, BKG-1 to BKG-10)
import { lockRow, prisma } from '../db'
import { addDays, weekday, type Day } from '../domain/dates'
import { cancelReturnsCredit } from '../domain/membership'
import type { Prisma } from '../generated/prisma/client'
import { fmtWhen } from '../lib/format'
import { conflict, HttpError, notFound } from '../lib/http'
import { sendMessage } from '../lib/messages'
import { getSettings } from '../lib/settings'
import { dbDay, istDay, istInstant, todayIst, toDbDate } from '../lib/time'
import { entitlementFor } from './memberships'

const AHEAD_DAYS = 28

/** Creates classes for every active series up to 4 weeks ahead, skipping closures. Safe to run often. */
export async function generateSeriesClasses(today: Day = todayIst()) {
  const series = await prisma.classSeries.findMany({ where: { active: true } })
  const closures = await prisma.closure.findMany({ where: { toDate: { gte: toDbDate(today) } } })
  const closed = (d: Day) => closures.some((c) => d >= dbDay(c.fromDate) && d <= dbDay(c.toDate))
  let created = 0
  for (const s of series) {
    const days = s.weekdays.split(',').map(Number)
    const rows: Prisma.ClassCreateManyInput[] = []
    for (let i = 0; i <= AHEAD_DAYS; i++) {
      const d = addDays(today, i)
      if (d < dbDay(s.fromDate) || (s.untilDate && d > dbDay(s.untilDate))) continue
      if (!days.includes(weekday(d)) || closed(d)) continue
      rows.push({
        seriesId: s.id,
        programId: s.programId,
        coachId: s.coachId,
        title: s.title,
        startsAt: istInstant(d, s.startTimeIst),
        durationMin: s.durationMin,
        mode: s.mode,
        locationOrLink: s.locationOrLink,
        capacity: s.capacity,
      })
    }
    if (rows.length) created += (await prisma.class.createMany({ data: rows, skipDuplicates: true })).count
  }
  return created
}

const ACTIVE = ['BOOKED', 'TRIAL'] as const

/** Books one profile into one class inside a transaction that locks the class row (BKG-1) */
export async function bookClass(profileId: string, classId: string, opts: { walkIn?: boolean } = {}) {
  const settings = await getSettings()
  const result = await prisma.$transaction(async (tx) => {
    await lockRow(tx, 'Class', classId)
    const cls = await tx.class.findUnique({ where: { id: classId }, include: { program: true } })
    if (!cls || cls.status !== 'SCHEDULED') throw notFound('This class is not open for booking')
    const now = new Date()
    const closesAt = new Date(cls.startsAt.getTime() + (cls.mode === 'ONLINE' ? 5 * 60_000 : 0))
    if (!opts.walkIn && now > closesAt) throw conflict('Booking for this class has closed', 'CLOSED')
    const profile = await tx.profile.findUniqueOrThrow({ where: { id: profileId } })
    const aud = cls.program.audience
    if ((aud === 'KIDS' && profile.kind !== 'CHILD') || (aud === 'ADULTS' && profile.kind !== 'ADULT')) {
      throw conflict(aud === 'KIDS' ? 'This class is for kids' : 'This class is for adults', 'AUDIENCE')
    }
    const existing = await tx.booking.findUnique({ where: { classId_profileId: { classId, profileId } } })
    if (existing && (ACTIVE as readonly string[]).includes(existing.status)) throw conflict(`${profile.name} is already booked`, 'ALREADY_BOOKED')
    const taken = await tx.booking.count({ where: { classId, status: { in: [...ACTIVE] } } })
    if (taken >= cls.capacity) throw conflict('This class is full', 'FULL')
    const ent = await entitlementFor(tx, profileId, { startsAt: cls.startsAt, programId: cls.programId, programName: cls.program.name }, settings.graceDays)
    if (!ent.ok) throw new HttpError(409, ent.code, ent.message)
    const data = { status: 'BOOKED' as const, membershipId: ent.membershipId, creditUsed: true, makeupUsed: ent.usesMakeup, freeCancel: false, cancelledAt: null }
    const booking = existing
      ? await tx.booking.update({ where: { id: existing.id }, data })
      : await tx.booking.create({ data: { classId, profileId, ...data } })
    await tx.waitlist.deleteMany({ where: { classId, profileId } })
    return { booking, cls, profile }
  })
  const owner = await prisma.guardian.findFirst({ where: { profileId }, orderBy: { createdAt: 'asc' } })
  if (owner) {
    await sendMessage({
      accountId: owner.accountId,
      template: 'booking_confirmed',
      data: { profile: result.profile.name, title: result.cls.title, when: fmtWhen(result.cls.startsAt), where: result.cls.mode === 'OFFLINE' ? `Location: ${result.cls.locationOrLink}` : 'The join link appears in the app 30 minutes before start.' },
      dedupeKey: `booked:${result.booking.id}:${result.booking.updatedAt.getTime()}`,
    })
  }
  return result.booking
}

/** Member cancels (BKG-3). Returns whether the class went back on the plan. */
export async function cancelBooking(bookingId: string) {
  const settings = await getSettings()
  const b = await prisma.booking.findUnique({ where: { id: bookingId }, include: { class: true, profile: true } })
  if (!b || b.status !== 'BOOKED') throw notFound('Booking not found')
  if (b.class.startsAt <= new Date()) throw conflict('This class has already started', 'STARTED')
  const returned = b.freeCancel || cancelReturnsCredit(b.class.startsAt, new Date(), settings.cancellationCutoffHours)
  await prisma.booking.update({
    where: { id: b.id },
    data: returned ? { status: 'CANCELLED', creditUsed: false, makeupUsed: false, cancelledAt: new Date() } : { status: 'LATE_CANCELLED', cancelledAt: new Date() },
  })
  const owner = await prisma.guardian.findFirst({ where: { profileId: b.profileId }, orderBy: { createdAt: 'asc' } })
  if (owner) {
    await sendMessage({
      accountId: owner.accountId,
      template: 'booking_cancelled',
      data: { profile: b.profile.name, title: b.class.title, when: fmtWhen(b.class.startsAt), credit: returned ? 'The class is back on your plan.' : 'This was inside the cancellation window, so the class is used.' },
      dedupeKey: `cancel:${b.id}:${Date.now()}`,
    })
  }
  await promoteWaitlist(b.classId)
  return { returned }
}

/** First waiting profile with an entitlement gets the spot (BKG-7) */
export async function promoteWaitlist(classId: string) {
  const cls = await prisma.class.findUnique({ where: { id: classId } })
  if (!cls || cls.startsAt.getTime() - Date.now() < 2 * 3600_000) return
  const queue = await prisma.waitlist.findMany({ where: { classId }, orderBy: { createdAt: 'asc' } })
  for (const w of queue) {
    try {
      const booking = await bookClass(w.profileId, classId)
      const owner = await prisma.guardian.findFirst({ where: { profileId: w.profileId }, include: { profile: true } })
      if (owner) await sendMessage({ accountId: owner.accountId, template: 'waitlist_promoted', data: { profile: owner.profile.name, title: cls.title, when: fmtWhen(cls.startsAt) }, dedupeKey: `wl:${booking.id}` })
      return
    } catch (e) {
      if (e instanceof HttpError && e.code === 'FULL') return
      await prisma.waitlist.delete({ where: { id: w.id } }) // no longer eligible
    }
  }
}

/** Studio cancels a class (CLS-7): credits back, a make-up credit for limited plans, everyone notified */
export async function studioCancelClass(classId: string, reason: string) {
  const cls = await prisma.class.update({ where: { id: classId }, data: { status: 'CANCELLED', notes: reason }, include: { bookings: { where: { status: { in: ['BOOKED', 'TRIAL'] } }, include: { membership: { include: { plan: true } }, profile: true } } } })
  for (const b of cls.bookings) {
    await prisma.booking.update({ where: { id: b.id }, data: { status: 'CANCELLED', creditUsed: false, makeupUsed: false, cancelledAt: new Date() } })
    const limited = b.membership?.plan.creditsPerCycle != null
    if (limited) {
      const end = b.membership ? dbDay(b.membership.endDate) : todayIst()
      await prisma.creditAdjustment.create({ data: { profileId: b.profileId, membershipId: b.membershipId, delta: 1, kind: 'MAKEUP', expiresOn: toDbDate(addDays(end, 31)), reason: `Studio cancelled ${cls.title} on ${istDay(cls.startsAt)}` } })
    }
    const owner = await prisma.guardian.findFirst({ where: { profileId: b.profileId }, orderBy: { createdAt: 'asc' } })
    if (owner) await sendMessage({ accountId: owner.accountId, template: 'class_cancelled', data: { title: cls.title, when: fmtWhen(cls.startsAt), makeup: limited ? 1 : 0 }, dedupeKey: `ccancel:${b.id}` })
  }
  await prisma.waitlist.deleteMany({ where: { classId } })
  return cls.bookings.length
}

/** Notify booked members of a change (CLS-6); a big change allows free cancellation */
export async function notifyClassChange(classId: string, change: string, allowFreeCancel: boolean) {
  const bookings = await prisma.booking.findMany({ where: { classId, status: 'BOOKED' }, include: { class: true } })
  for (const b of bookings) {
    if (allowFreeCancel) await prisma.booking.update({ where: { id: b.id }, data: { freeCancel: true } })
    const owner = await prisma.guardian.findFirst({ where: { profileId: b.profileId }, orderBy: { createdAt: 'asc' } })
    if (owner) await sendMessage({ accountId: owner.accountId, template: 'class_changed', data: { title: b.class.title, change }, dedupeKey: `cchange:${b.id}:${Date.now()}` })
  }
}
