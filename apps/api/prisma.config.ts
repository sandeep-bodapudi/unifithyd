import 'dotenv/config'
import fs from 'node:fs'
import { defineConfig } from 'prisma/config'
import { dbProvider } from './src/dbProvider'

// prisma/schema.prisma is the one schema to edit, written for MySQL. Prisma cannot read the
// provider from the environment, so for a postgresql:// DATABASE_URL we write a copy with the
// provider swapped (prisma/postgresql/schema.prisma, git-ignored) and use its own migrations folder.
// Both databases accept every @db attribute the schema uses (Date, Text, Decimal).
const provider = process.env.DATABASE_URL ? dbProvider() : 'mysql'

function schemaFor(target: 'mysql' | 'postgresql') {
  if (target === 'mysql') return { schema: 'prisma/schema.prisma', migrations: 'prisma/migrations' }
  const source = fs.readFileSync('prisma/schema.prisma', 'utf8')
  const pg = source
    .replace(/(datasource db \{\s*provider\s*=\s*)"mysql"/, '$1"postgresql"')
    .replace('output   = "../src/generated/prisma"', 'output   = "../../src/generated/prisma"')
  if (!pg.includes('"postgresql"') || !pg.includes('"../../src/generated/prisma"')) {
    throw new Error('prisma.config.ts: could not derive the PostgreSQL schema; update the replacements to match prisma/schema.prisma')
  }
  const header = '// GENERATED from prisma/schema.prisma by prisma.config.ts. Do not edit.\n'
  fs.mkdirSync('prisma/postgresql', { recursive: true })
  fs.writeFileSync('prisma/postgresql/schema.prisma', header + pg)
  return { schema: 'prisma/postgresql/schema.prisma', migrations: 'prisma/postgresql/migrations' }
}

const paths = schemaFor(provider)

export default defineConfig({
  schema: paths.schema,
  migrations: {
    path: paths.migrations,
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
})
