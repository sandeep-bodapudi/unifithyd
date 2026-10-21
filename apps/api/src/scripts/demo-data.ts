// Sample studio data for client demos (DEMO_MODE=true deployments only). Safe to run on every start:
// it does nothing once the demo owner exists. All people, emails and phone numbers are made up.
// Usage: DEMO_MODE=true DEMO_PASSWORD=... npm run demo:data -w @unifit/api
import type { Request } from 'express'
import { prisma } from '../db'
import { addDays, type Day } from '../domain/dates'
import { env } from '../env'
import { hashPassword } from '../lib/crypto'
import { setSettings } from '../lib/settings'
import { istInstant, todayIst, toDbDate } from '../lib/time'
import { DOC_VERSIONS } from '../routes/auth'
import { verifyPayment } from '../services/payments'
import { bookClass, generateSeriesClasses } from '../services/schedule'

const OWNER_EMAIL = 'owner@example.com'
const password = process.env.DEMO_PASSWORD ?? ''

if (!env.DEMO_MODE) {
  console.error('demo-data: set DEMO_MODE=true. This script is for demo deployments only.')
  process.exit(1)
}
if (password.length < 10) {
  console.error('demo-data: set DEMO_PASSWORD (10+ characters) for the demo staff accounts.')
  process.exit(1)
}
if (await prisma.account.findUnique({ where: { email: OWNER_EMAIL } })) {
  console.log('demo-data: already loaded')
  await prisma.$disconnect()
  process.exit(0)
}

const today = todayIst()
const hash = await hashPassword(password)

async function staff(name: string, email: string, phone: string, roles: ('OWNER' | 'ADMIN' | 'COACH')[]) {
  return prisma.account.create({ data: { name, email, phone, passwordHash: hash, roles: { create: roles.map((role) => ({ role })) } } })
}

const owner = await staff('Demo Owner', OWNER_EMAIL, '9000000001', ['OWNER', 'ADMIN'])
const coach = await staff('Arjun Coach', 'coach@example.com', '9000000002', ['COACH'])
const programs = Object.fromEntries((await prisma.program.findMany()).map((p) => [p.name, p]))
const plans = Object.fromEntries((await prisma.plan.findMany()).map((p) => [p.shortCode, p]))
await prisma.account.update({ where: { id: coach.id }, data: { coachPrograms: { connect: Object.values(programs).map((p) => ({ id: p.id })) } } })
await setSettings({ upiId: 'unifit.demo@okaxis', upiPayeeName: 'Unifit.hyd' }, owner.id)

// Weekly timetable; classes are generated from 10 days ago so there is some history
const series = [
  { title: 'Kids Strength & Agility', program: 'Kids Training', weekdays: '1,3,5', startTimeIst: '17:00', mode: 'OFFLINE', locationOrLink: 'Studio, Hall A', capacity: 15 },
  { title: 'Adult HIIT', program: 'Adult Training', weekdays: '2,4,6', startTimeIst: '07:00', mode: 'OFFLINE', locationOrLink: 'Studio, Hall B', capacity: 6 },
  { title: 'Evening Zumba', program: 'Group Classes', weekdays: '1,2,3,4,5,6', startTimeIst: '19:00', mode: 'ONLINE', locationOrLink: 'https://meet.google.com/demo-unifit', capacity: 20 },
  { title: 'Weekend Yoga', program: 'Group Classes', weekdays: '6,7', startTimeIst: '08:30', mode: 'OFFLINE', locationOrLink: 'Studio, Hall A', capacity: 20 },
] as const
for (const s of series) {
  const { program, ...rest } = s
  await prisma.classSeries.create({ data: { ...rest, programId: programs[program].id, coachId: coach.id, durationMin: 60, fromDate: toDbDate(addDays(today, -10)) } })
}
await generateSeriesClasses(addDays(today, -10))

// Members: [account name, email, phone, profiles, plan, paid days ago, payment state]
type Person = { name: string; dob: Day; kind: 'ADULT' | 'CHILD' }
const members: { name: string; email: string; phone: string; people: Person[]; plan: string; paidDaysAgo: number; state: 'VERIFIED' | 'PENDING' }[] = [
  { name: 'Priya Reddy', email: 'priya@example.com', phone: '9000000101', people: [{ name: 'Priya Reddy', dob: '1992-04-12', kind: 'ADULT' }], plan: 'ADULT', paidDaysAgo: 12, state: 'VERIFIED' },
  { name: 'Rahul Varma', email: 'rahul@example.com', phone: '9000000102', people: [{ name: 'Rahul Varma', dob: '1988-09-30', kind: 'ADULT' }], plan: 'GROUP', paidDaysAgo: 20, state: 'VERIFIED' },
  { name: 'Sneha Rao', email: 'sneha@example.com', phone: '9000000103', people: [{ name: 'Sneha Rao', dob: '1995-01-22', kind: 'ADULT' }], plan: 'GROUP', paidDaysAgo: 5, state: 'VERIFIED' },
  { name: 'Kiran Kumar', email: 'parent@example.com', phone: '9000000104', people: [{ name: 'Aarav Kumar', dob: '2015-06-15', kind: 'CHILD' }, { name: 'Diya Kumar', dob: '2017-11-02', kind: 'CHILD' }], plan: 'KIDS', paidDaysAgo: 15, state: 'VERIFIED' },
  { name: 'Meera Iyer', email: 'meera@example.com', phone: '9000000105', people: [{ name: 'Meera Iyer', dob: '1990-07-08', kind: 'ADULT' }], plan: 'GROUP', paidDaysAgo: 31, state: 'VERIFIED' }, // shows as due
  { name: 'Vikram Shah', email: 'vikram@example.com', phone: '9000000106', people: [{ name: 'Vikram Shah', dob: '1985-03-18', kind: 'ADULT' }], plan: 'ADULT', paidDaysAgo: 1, state: 'PENDING' }, // to verify
  { name: 'Ananya Das', email: 'ananya@example.com', phone: '9000000107', people: [{ name: 'Ananya Das', dob: '1998-12-25', kind: 'ADULT' }], plan: 'GROUP', paidDaysAgo: 0, state: 'PENDING' },
]

const req = { account: owner, ip: '127.0.0.1', get: () => undefined, headers: {} } as unknown as Request
const active: string[] = []
let utr = 410000000000
for (const m of members) {
  const acc = await prisma.account.create({ data: { name: m.name, email: m.email, phone: m.phone, roles: { create: [{ role: 'MEMBER' }] } } })
  for (const person of m.people) {
    const profile = await prisma.profile.create({ data: { name: person.name, dob: toDbDate(person.dob), kind: person.kind, guardians: { create: { accountId: acc.id } } } })
    for (const [document, version] of Object.entries(DOC_VERSIONS)) {
      await prisma.consent.create({ data: { profileId: profile.id, acceptedById: acc.id, document, version } })
    }
    const plan = plans[m.plan]
    const pay = await prisma.payment.create({
      data: { profileId: profile.id, planId: plan.id, amountPaise: plan.pricePaise, utr: String(++utr), upiNote: `UF ${plan.shortCode}`, paidOn: toDbDate(addDays(today, -m.paidDaysAgo)) },
    })
    if (m.state === 'VERIFIED') {
      await verifyPayment(req, pay.id)
      if (m.paidDaysAgo < 30) active.push(profile.id)
    }
  }
}

// Past classes: most active members attended; upcoming: a few bookings each
const classes = await prisma.class.findMany({ orderBy: { startsAt: 'asc' } })
const now = new Date()
let booked = 0
for (const profileId of active) {
  let n = 0
  for (const c of classes) {
    const past = c.startsAt < now
    if (!past && n >= 3) break
    try {
      const b = await bookClass(profileId, c.id, { walkIn: past })
      if (past) {
        await prisma.booking.update({ where: { id: b.id }, data: { status: 'ATTENDED' } })
        await prisma.attendance.create({ data: { classId: c.id, profileId, method: 'QR', byAccountId: coach.id, at: new Date(c.startsAt.getTime() + 5 * 60_000) } })
      } else n++
      booked++
    } catch {
      // not entitled to this program, weekly cap or full: skip
    }
  }
}
await prisma.class.updateMany({ where: { startsAt: { lt: istInstant(today, '00:00') } }, data: { status: 'COMPLETED' } })

// Weight log for the member view
const priya = await prisma.profile.findFirstOrThrow({ where: { name: 'Priya Reddy' } })
for (const [i, kg] of [68.4, 67.9, 67.5, 67.1].entries()) {
  await prisma.weightLog.create({ data: { profileId: priya.id, date: toDbDate(addDays(today, -21 + i * 7)), weightKg: kg } })
}

// Leads from the website trial form
const leads = [
  { name: 'Rohit Menon', phone: '9000000201', program: 'Adult Training', preferredTime: 'Morning', status: 'NEW' },
  { name: 'Lakshmi Prasad', phone: '9000000202', program: 'Kids Training', forChildAge: 9, preferredTime: 'Evening', status: 'NEW', followUpOn: toDbDate(today) },
  { name: 'Farhan Ali', phone: '9000000203', program: 'Group Classes', preferredTime: 'Evening', status: 'ATTENDED', notes: 'Enjoyed Zumba, asked about the monthly plan' },
  { name: 'Divya Nair', phone: '9000000204', program: 'Group Classes', status: 'LOST', notes: 'Moved to another city' },
] as const
for (const l of leads) await prisma.lead.create({ data: { ...l } })

console.log(`demo-data: loaded ${members.length} member accounts, ${classes.length} classes, ${booked} bookings, ${leads.length} leads`)
await prisma.$disconnect()
