// Trial sign-ups from the website (LEAD-1, LEAD-6)
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { prisma } from '../db'

export const leadsRouter = Router()

const leadInput = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
  program: z.enum(['kids', 'adult', 'group']),
  forWhom: z.enum(['self', 'child']),
  childAge: z.coerce.number().int().min(3).max(17).optional(),
  preferredTime: z.enum(['morning', 'afternoon', 'evening']).optional(),
  source: z.string().max(40).default('website'),
})

// 5 sign-ups per IP per hour is plenty for real people
const limiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false })

leadsRouter.post('/', limiter, async (req, res, next) => {
  const parsed = leadInput.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'INVALID_INPUT', issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) })
    return
  }
  const d = parsed.data
  if (d.forWhom === 'child' && d.childAge === undefined) {
    res.status(400).json({ error: 'INVALID_INPUT', issues: [{ path: 'childAge', message: "Please add your child's age" }] })
    return
  }
  try {
    // One open lead per phone: a repeat sign-up updates the existing lead (LEAD-2)
    const existing = await prisma.lead.findFirst({ where: { phone: d.phone, status: { not: 'LOST' } } })
    const data = {
      name: d.name,
      phone: d.phone,
      program: d.program,
      forChildAge: d.forWhom === 'child' ? d.childAge : null,
      preferredTime: d.preferredTime,
      source: d.source,
    }
    const lead = existing ? await prisma.lead.update({ where: { id: existing.id }, data }) : await prisma.lead.create({ data })
    res.status(existing ? 200 : 201).json({ id: lead.id })
  } catch (e) {
    next(e)
  }
})
