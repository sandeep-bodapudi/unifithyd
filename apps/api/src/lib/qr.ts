// Signed check-in tokens (PRD section 9). Ed25519 so scanners can verify offline with the public key.
import { createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify, type KeyObject } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { env, isProd } from '../env'

let priv: KeyObject
let pub: KeyObject

function loadKeys() {
  if (priv) return
  let pem = env.QR_PRIVATE_KEY ? Buffer.from(env.QR_PRIVATE_KEY, 'base64').toString('utf8') : null
  if (!pem) {
    if (isProd && !env.DEMO_MODE) throw new Error('QR_PRIVATE_KEY is required in production')
    // Development and demos: create a key once and keep it in the git-ignored .data folder
    const file = path.resolve(import.meta.dirname, '../../../../.data/qr-key.pem')
    if (fs.existsSync(file)) pem = fs.readFileSync(file, 'utf8')
    else {
      pem = generateKeyPairSync('ed25519').privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, pem)
    }
  }
  priv = createPrivateKey(pem)
  pub = createPublicKey(priv)
}

const b64u = (b: Buffer | string) => Buffer.from(b).toString('base64url')

export type TokenPayload = { p: string; e: number; t: 'live' | 'day' }

export function signToken(payload: TokenPayload): string {
  loadKeys()
  const body = b64u(JSON.stringify(payload))
  return `${body}.${b64u(sign(null, Buffer.from(body), priv))}`
}

export function verifyToken(token: string, now = Date.now()): { ok: true; payload: TokenPayload } | { ok: false; reason: string } {
  loadKeys()
  const [body, sig] = token.split('.')
  if (!body || !sig) return { ok: false, reason: 'Not a Unifit QR code' }
  if (!verify(null, Buffer.from(body), pub, Buffer.from(sig, 'base64url'))) return { ok: false, reason: 'This QR code is not valid' }
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as TokenPayload
  if (payload.e * 1000 < now) return { ok: false, reason: 'This QR code has expired. Ask the member to refresh it.' }
  return { ok: true, payload }
}

/** Raw 32-byte public key (base64url) for offline verification in the scanner */
export function publicKeyRaw(): string {
  loadKeys()
  return (pub.export({ format: 'jwk' }) as { x: string }).x
}
