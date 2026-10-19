import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { PrismaClient } from './generated/prisma/client'
import { env } from './env'

// MySQL 8 through the MariaDB driver adapter (Prisma 7 requires a driver adapter)
export const prisma = new PrismaClient({ adapter: new PrismaMariaDb(env.DATABASE_URL) })
