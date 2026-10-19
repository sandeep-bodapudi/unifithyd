import cookieParser from 'cookie-parser'
import express, { type ErrorRequestHandler } from 'express'
import helmet from 'helmet'
import { prisma } from './db'
import { env } from './env'
import { csrfGuard, loadSession } from './lib/auth'
import { HttpError } from './lib/http'
import { startJobs } from './jobs'
import { adminRouter } from './routes/admin'
import { attendanceRouter } from './routes/attendance'
import { authRouter } from './routes/auth'
import { classesRouter } from './routes/classes'
import { leadsRouter } from './routes/leads'
import { paymentsRouter } from './routes/payments'
import { publicRouter } from './routes/public'
import { staffRouter } from './routes/staff'

const app = express()
app.set('trust proxy', 1)
app.use(helmet())
app.use(express.json({ limit: '3mb' })) // payment screenshots arrive as data URLs (2 MB max)
app.use(cookieParser())
app.use('/api', csrfGuard, loadSession)

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ ok: true, db: 'up' })
  } catch {
    res.status(503).json({ ok: false, db: 'down' })
  }
})

app.use('/api/public', publicRouter)
app.use('/api/leads', leadsRouter)
app.use('/api/auth', authRouter)
app.use('/api/classes', classesRouter)
app.use('/api/attendance', attendanceRouter)
app.use('/api/payments', paymentsRouter)
app.use('/api/staff', staffRouter)
app.use('/api/admin', adminRouter)

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'NOT_FOUND' })
})

const onError: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.code, message: err.message, details: err.details })
    return
  }
  console.error(err)
  res.status(500).json({ error: 'SERVER_ERROR', message: 'Something went wrong. Please try again.' })
}
app.use(onError)

app.listen(env.PORT, () => {
  console.log(`Unifit API on http://localhost:${env.PORT}`)
  if (env.JOBS_ENABLED) startJobs()
})
