// One-time setup of the owner account (ACC-4, section 6.1). No demo passwords exist anywhere.
// Usage: npm run owner:create -w @unifit/api -- --name "Owner Name" --email owner@example.com --phone 9876543210
import { parseArgs } from 'node:util'
import { prisma } from '../db'
import { hashPassword, randomToken } from '../lib/crypto'

const { values } = parseArgs({ options: { name: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' } } })
const name = values.name?.trim()
const email = values.email?.trim().toLowerCase()
const phone = values.phone?.trim()

if (!name || !email || !/^\S+@\S+\.\S+$/.test(email) || !phone || !/^[6-9]\d{9}$/.test(phone)) {
  console.error('Usage: --name "Full Name" --email you@example.com --phone 10-digit-mobile')
  process.exit(1)
}

const existingOwner = await prisma.accountRole.findFirst({ where: { role: 'OWNER' } })
if (existingOwner) {
  console.error('An owner already exists. Add other staff from the dashboard.')
  process.exit(1)
}

const password = randomToken(12)
const acc = await prisma.account.upsert({
  where: { email },
  update: { passwordHash: await hashPassword(password) },
  create: { name, email, phone, passwordHash: await hashPassword(password) },
})
for (const role of ['OWNER', 'ADMIN'] as const) {
  await prisma.accountRole.upsert({ where: { accountId_role: { accountId: acc.id, role } }, update: {}, create: { accountId: acc.id, role } })
}
console.log(`\nOwner account ready for ${email}.\nTemporary password (shown once, change it after logging in): ${password}\n`)
await prisma.$disconnect()
