import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import cookieParser from 'cookie-parser'
import express, { type ErrorRequestHandler } from 'express'
import helmet from 'helmet'
import { prisma } from './db'
import { env } from './env'
import { csrfGuard, loadSession } from './lib/auth'
import { HttpError } from './lib/http'
import { startJobs } from './jobs'
import { startKeepAwake } from './keepAwake'
import { adminRouter } from './routes/admin'
import { attendanceRouter } from './routes/attendance'
import { authRouter } from './routes/auth'
import { classesRouter } from './routes/classes'
import { leadsRouter } from './routes/leads'
import { paymentsRouter } from './routes/payments'
import { publicRouter } from './routes/public'
import { staffRouter } from './routes/staff'

const webDist = path.resolve(import.meta.dirname, '../../web/dist')
const webIndex = fs.existsSync(path.join(webDist, 'index.html')) ? fs.readFileSync(path.join(webDist, 'index.html'), 'utf8') : null
// Hashes of the inline scripts in index.html (theme before first paint), so the CSP can allow exactly those
const inlineScriptHashes = [...(webIndex ?? '').matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
  (m) => `'sha256-${crypto.createHash('sha256').update(m[1]).digest('base64')}'`,
)

const app = express()
app.set('trust proxy', 1)
app.use(helmet({ contentSecurityPolicy: { directives: { scriptSrc: ["'self'", ...inlineScriptHashes] } } }))
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

// Production: serve the built website and app (apps/web/dist) from the same origin as the API,
// so cookies and the relative /api calls work without a proxy. In development Vite serves it.
if (webIndex) {
  app.use(
    express.static(webDist, {
      index: false,
      setHeaders: (res, file) => {
        const name = path.basename(file)
        if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
        else if (name === 'sw.js' || name.startsWith('workbox-') || name.endsWith('.webmanifest')) res.setHeader('Cache-Control', 'no-cache')
      },
    }),
  )
  // Client-side routes (/, /app/...) get index.html; missing files still 404
  app.use((req, res, next) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || path.extname(req.path)) return next()
    res.setHeader('Cache-Control', 'no-cache')
    res.sendFile(path.join(webDist, 'index.html'))
  })
}

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
  if (env.KEEP_AWAKE) startKeepAwake()
})
