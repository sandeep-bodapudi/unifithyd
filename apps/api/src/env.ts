import 'dotenv/config'
import { z } from 'zod'

const schema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required (see .env.example)'),
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ORIGIN: z.string().default('http://localhost:5173'),
  // Long random string; signs class codes and hashes login codes
  APP_SECRET: z.string().min(32, 'APP_SECRET must be at least 32 characters'),
  // Ed25519 key for check-in QR tokens, PKCS8 PEM (base64 of the PEM text). Generated in development if missing.
  QR_PRIVATE_KEY: z.string().optional(),
  // Email: Resend API key and sender. Without a key, emails are printed to the console.
  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().default('Unifit.hyd <no-reply@unifithyd.com>'),
  // Development only: return login codes in the API response for testing
  DEV_SHOW_CODES: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  // Client demos on a public URL with sample data only: shows login codes on screen even in
  // production (with DEV_SHOW_CODES=true) and generates the QR key if none is set. Never for real members.
  DEMO_MODE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  JOBS_ENABLED: z
    .string()
    .default('true')
    .transform((v) => v !== 'false'),
  // Render free plan: ping our own public URL so the service never idles long enough to sleep.
  // Render sets RENDER_EXTERNAL_URL; KEEP_AWAKE_URL overrides it on other hosts.
  KEEP_AWAKE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  KEEP_AWAKE_URL: z.string().url().optional(),
  RENDER_EXTERNAL_URL: z.string().url().optional(),
})

export const env = schema.parse(process.env)
export const isProd = env.NODE_ENV === 'production'
/** Return login codes in API responses (development, or a demo deployment) */
export const showCodes = env.DEV_SHOW_CODES && (!isProd || env.DEMO_MODE)
