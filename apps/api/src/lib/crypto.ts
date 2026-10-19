import { createHash, createHmac, randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { env } from '../env'

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }

/** Password hash: scrypt with a random salt (memory-hard, built into Node) */
export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await scrypt(pw, salt, 64, SCRYPT)
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`
}

export async function verifyPassword(pw: string, stored: string | null): Promise<boolean> {
  if (!stored?.startsWith('scrypt$')) return false
  const [, saltB64, keyB64] = stored.split('$')
  const key = await scrypt(pw, Buffer.from(saltB64, 'base64'), 64, SCRYPT)
  const expected = Buffer.from(keyB64, 'base64')
  return expected.length === key.length && timingSafeEqual(expected, key)
}

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

/** Login codes are stored hashed with a server secret, never in plain text */
export const hashCode = (accountId: string, code: string) => createHmac('sha256', env.APP_SECRET).update(`${accountId}:${code}`).digest('hex')

export const sixDigits = () => String(randomInt(0, 1_000_000)).padStart(6, '0')

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url')

export const safeEqual = (a: string, b: string) => {
  const A = Buffer.from(a)
  const B = Buffer.from(b)
  return A.length === B.length && timingSafeEqual(A, B)
}

/** Rotating 4-digit class code, new every 60 seconds (ATT-8) */
export function classCode(classId: string, at = Date.now()): string {
  const window = Math.floor(at / 60_000)
  const mac = createHmac('sha256', env.APP_SECRET).update(`${classId}:${window}`).digest()
  return String(mac.readUInt32BE(0) % 10_000).padStart(4, '0')
}
