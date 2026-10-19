// Reference data from the owner's decisions (PRD v3.0 sections 5.1, 7.1, 7.2).
// Safe to run more than once. Classes and members are not seeded: they come
// from the coaches' timetable and the member import (MIG-1 to MIG-5).
import 'dotenv/config'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { PrismaClient } from '../src/generated/prisma/client'

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL!) })

async function main() {
  const programs = [
    { name: 'Kids Training', audience: 'KIDS', defaultCapacity: 15 },
    { name: 'Adult Training', audience: 'ADULTS', defaultCapacity: 6 },
    { name: 'Group Classes', audience: 'ADULTS', defaultCapacity: 20 },
  ] as const
  const ids: Record<string, string> = {}
  for (const p of programs) {
    const row = await prisma.program.upsert({ where: { name: p.name }, update: {}, create: p })
    ids[p.name] = row.id
  }

  const plans = [
    { name: 'Kids Training', shortCode: 'KIDS', pricePaise: 300000, creditsPerCycle: 12, weeklyCap: 3, audience: 'KIDS', programs: ['Kids Training'] },
    // Q1 and Q3 defaults: unlimited, also covers Group Classes
    { name: 'Adult Training', shortCode: 'ADULT', pricePaise: 1500000, creditsPerCycle: null, weeklyCap: null, audience: 'ADULTS', programs: ['Adult Training', 'Group Classes'] },
    // Q2 default: adults, unlimited
    { name: 'Group Classes', shortCode: 'GROUP', pricePaise: 300000, creditsPerCycle: null, weeklyCap: null, audience: 'ADULTS', programs: ['Group Classes'] },
  ] as const
  for (const { programs: progs, ...plan } of plans) {
    const row = await prisma.plan.upsert({ where: { shortCode: plan.shortCode }, update: {}, create: { ...plan, cycleMonths: 1 } })
    for (const name of progs) {
      await prisma.planProgram.upsert({
        where: { planId_programId: { planId: row.id, programId: ids[name] } },
        update: {},
        create: { planId: row.id, programId: ids[name] },
      })
    }
  }

  const settings: Record<string, unknown> = {
    cancellationCutoffHours: 2,
    reminderHoursBefore: 2,
    graceDays: 3,
    blockIfDue: false,
    upiId: null,
    upiPayeeName: null,
    gstEnabled: false,
  }
  for (const [key, value] of Object.entries(settings)) {
    await prisma.setting.upsert({ where: { key }, update: {}, create: { key, value: value as never } })
  }
  console.log('Seeded programs, plans and default settings')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
