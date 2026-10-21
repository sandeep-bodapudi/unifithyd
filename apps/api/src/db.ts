import { Prisma, PrismaClient } from './generated/prisma/client'
import { createAdapter, dbProvider } from './dbProvider'
import { env } from './env'

export const provider = dbProvider(env.DATABASE_URL)
export const isPostgres = provider === 'postgresql'

export const prisma = new PrismaClient({ adapter: createAdapter(env.DATABASE_URL) })

type LockableTable = 'Class' | 'Payment'

/** SELECT ... FOR UPDATE on one row, inside the caller's transaction (identifier quoting differs per database) */
export async function lockRow(tx: Prisma.TransactionClient, table: LockableTable, id: string) {
  const name = Prisma.raw(isPostgres ? `"${table}"` : `\`${table}\``)
  await tx.$queryRaw`SELECT id FROM ${name} WHERE id = ${id} FOR UPDATE`
}

/**
 * Case-insensitive `contains` filter. MySQL's default collation already ignores case;
 * PostgreSQL needs mode: 'insensitive', which the MySQL client does not accept.
 */
export const containsText = (q: string) => (isPostgres ? { contains: q, mode: 'insensitive' } : { contains: q }) as { contains: string }
