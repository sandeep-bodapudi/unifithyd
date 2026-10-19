import express, { type ErrorRequestHandler } from 'express'
import helmet from 'helmet'
import { prisma } from './db'
import { env } from './env'
import { leadsRouter } from './routes/leads'
import { publicRouter } from './routes/public'

const app = express()
app.set('trust proxy', 1)
app.use(helmet())
app.use(express.json({ limit: '100kb' }))

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

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'NOT_FOUND' })
})

const onError: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'SERVER_ERROR' })
}
app.use(onError)

app.listen(env.PORT, () => {
  console.log(`Unifit API on http://localhost:${env.PORT}`)
})
