import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { PrismaPg } from '@prisma/adapter-pg'

// Which database DATABASE_URL points at. The rest of the app (Prisma schema and
// migrations folder, driver adapter, row locks, text search) follows from this.
export type DbProvider = 'mysql' | 'postgresql'

export function dbProvider(url = process.env.DATABASE_URL ?? ''): DbProvider {
  const scheme = url.slice(0, url.indexOf(':')).toLowerCase()
  if (scheme === 'postgres' || scheme === 'postgresql') return 'postgresql'
  if (scheme === 'mysql' || scheme === 'mariadb') return 'mysql'
  throw new Error(`DATABASE_URL must start with mysql:// or postgresql:// (got "${scheme}://")`)
}

// Prisma 7 requires a driver adapter: pg for PostgreSQL, the MariaDB driver for MySQL 8 and MariaDB.
// The generated client must match: run `npm run db:generate` after switching DATABASE_URL.
export const createAdapter = (url: string) =>
  dbProvider(url) === 'postgresql' ? new PrismaPg({ connectionString: url }) : new PrismaMariaDb(url)
