// Sessions and role checks (ACC-3, ACC-4, section 6.2). Every check runs on the server.
import type { NextFunction, Request, Response } from 'express'
import { prisma } from '../db'
import { isProd } from '../env'
import type { Role } from '../generated/prisma/client'
import { randomToken, sha256 } from './crypto'
import { forbidden, HttpError } from './http'

export type AuthAccount = { id: string; email: string; name: string; roles: Role[]; sessionId: string }

declare module 'express-serve-static-core' {
  interface Request {
    account?: AuthAccount
  }
}

const COOKIE = 'uf_session'
const MEMBER_TTL = 90 * 24 * 3600 * 1000
const STAFF_IDLE = 12 * 3600 * 1000

export const isStaff = (roles: Role[]) => roles.some((r) => r === 'COACH' || r === 'ADMIN' || r === 'OWNER')
export const isAdmin = (roles: Role[]) => roles.includes('ADMIN') || roles.includes('OWNER')

export async function startSession(res: Response, accountId: string, roles: Role[], device?: string) {
  const token = randomToken()
  const ttl = isStaff(roles) ? STAFF_IDLE : MEMBER_TTL
  await prisma.session.create({ data: { accountId, refreshHash: sha256(token), device: device?.slice(0, 200), expiresAt: new Date(Date.now() + ttl) } })
  res.cookie(COOKIE, token, { httpOnly: true, secure: isProd, sameSite: 'lax', maxAge: ttl, path: '/' })
}

export async function endSession(req: Request, res: Response) {
  if (req.account) await prisma.session.update({ where: { id: req.account.sessionId }, data: { revokedAt: new Date() } })
  res.clearCookie(COOKIE, { path: '/' })
}

/** Loads the session if there is one. Never fails; use requireAuth to insist. */
export async function loadSession(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[COOKIE]
    if (token) {
      const s = await prisma.session.findUnique({ where: { refreshHash: sha256(token) }, include: { account: { include: { roles: true } } } })
      if (s && !s.revokedAt && s.expiresAt > new Date() && !s.account.disabled) {
        const roles = s.account.roles.map((r) => r.role)
        req.account = { id: s.account.id, email: s.account.email, name: s.account.name, roles, sessionId: s.id }
        // Staff sessions slide: 12 hours from the last request (ACC-4)
        if (isStaff(roles)) {
          const expiresAt = new Date(Date.now() + STAFF_IDLE)
          if (expiresAt.getTime() - s.expiresAt.getTime() > 60_000) await prisma.session.update({ where: { id: s.id }, data: { expiresAt } })
        }
      }
    }
    next()
  } catch (e) {
    next(e)
  }
}

/** Simple CSRF guard on top of SameSite cookies: writes must come from our own fetch calls */
export function csrfGuard(req: Request, _res: Response, next: NextFunction) {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.get('X-Requested-With') !== 'unifit') {
    return next(new HttpError(403, 'CSRF', 'Request blocked'))
  }
  next()
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.account) return next(new HttpError(401, 'UNAUTHENTICATED', 'Please log in'))
  next()
}

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.account) return next(new HttpError(401, 'UNAUTHENTICATED', 'Please log in'))
    const ok = req.account.roles.some((r) => roles.includes(r) || r === 'OWNER')
    if (!ok) return next(forbidden())
    next()
  }

export const requireStaff = requireRole('COACH', 'ADMIN')
export const requireAdmin = requireRole('ADMIN')

/** Profiles this account may act for: its own and its children's (KID-1) */
export async function ownProfileIds(accountId: string): Promise<string[]> {
  const g = await prisma.guardian.findMany({ where: { accountId }, select: { profileId: true } })
  return g.map((x) => x.profileId)
}

export async function assertProfileAccess(req: Request, profileId: string) {
  const acc = req.account!
  if (isAdmin(acc.roles)) return
  const ids = await ownProfileIds(acc.id)
  if (!ids.includes(profileId)) throw forbidden('This profile is not on your account')
}
