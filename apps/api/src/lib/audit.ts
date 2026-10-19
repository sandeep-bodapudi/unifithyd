import type { Request } from 'express'
import { prisma } from '../db'
import type { Prisma } from '../generated/prisma/client'

type Tx = Prisma.TransactionClient | typeof prisma

/** Append-only audit trail (AuditLog). Pass the transaction client when inside one. */
export async function audit(
  db: Tx,
  req: Request | null,
  action: string,
  entity: string,
  entityId: string | null,
  oldValue?: unknown,
  newValue?: unknown,
) {
  await db.auditLog.create({
    data: {
      actorId: req?.account?.id ?? null,
      action,
      entity,
      entityId,
      oldValue: (oldValue ?? undefined) as never,
      newValue: (newValue ?? undefined) as never,
      ip: req?.ip ?? null,
    },
  })
}
