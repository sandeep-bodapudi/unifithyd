// Public, read-only data for the website (WEB-1, WEB-2). Never exposes meeting links.
import { Router } from 'express'
import { prisma } from '../db'

export const publicRouter = Router()

publicRouter.get('/plans', async (_req, res, next) => {
  try {
    const plans = await prisma.plan.findMany({
      where: { public: true, active: true },
      orderBy: { pricePaise: 'asc' },
      select: { id: true, name: true, shortCode: true, pricePaise: true, cycleMonths: true, creditsPerCycle: true, weeklyCap: true, audience: true },
    })
    res.json({ plans })
  } catch (e) {
    next(e)
  }
})

publicRouter.get('/schedule', async (_req, res, next) => {
  try {
    const now = new Date()
    const in7Days = new Date(now.getTime() + 7 * 86_400_000)
    const classes = await prisma.class.findMany({
      where: { status: 'SCHEDULED', startsAt: { gte: now, lt: in7Days } },
      orderBy: { startsAt: 'asc' },
      select: {
        id: true,
        title: true,
        startsAt: true,
        durationMin: true,
        mode: true,
        capacity: true,
        program: { select: { name: true } },
        _count: { select: { bookings: { where: { status: { in: ['BOOKED', 'TRIAL'] } } } } },
      },
    })
    res.json({
      classes: classes.map((c) => ({
        id: c.id,
        title: c.title,
        program: c.program.name,
        startsAt: c.startsAt.toISOString(),
        durationMin: c.durationMin,
        mode: c.mode,
        spotsLeft: Math.max(0, c.capacity - c._count.bookings),
      })),
    })
  } catch (e) {
    next(e)
  }
})
