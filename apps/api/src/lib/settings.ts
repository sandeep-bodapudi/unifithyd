import { prisma } from '../db'

export type Settings = {
  studioName: string
  cancellationCutoffHours: number
  reminderHoursBefore: number
  graceDays: number
  blockIfDue: boolean
  upiId: string | null
  upiPayeeName: string | null
  /** PAY-2: a UPI change waits here until it goes live */
  upiPending: { upiId: string; upiPayeeName: string; effectiveAt: string; byAccountId: string } | null
  gstEnabled: boolean
  gstNumber: string | null
  gstRatePercent: number
}

const DEFAULTS: Settings = {
  studioName: 'Unifit.hyd',
  cancellationCutoffHours: 2,
  reminderHoursBefore: 2,
  graceDays: 3,
  blockIfDue: false,
  upiId: null,
  upiPayeeName: null,
  upiPending: null,
  gstEnabled: false,
  gstNumber: null,
  gstRatePercent: 5,
}

export async function getSettings(): Promise<Settings> {
  const rows = await prisma.setting.findMany()
  const s: Record<string, unknown> = { ...DEFAULTS }
  for (const r of rows) if (r.key in DEFAULTS) s[r.key] = r.value
  const settings = s as Settings
  // Apply a pending UPI change once its delay has passed
  if (settings.upiPending && new Date(settings.upiPending.effectiveAt) <= new Date()) {
    const p = settings.upiPending
    await setSettings({ upiId: p.upiId, upiPayeeName: p.upiPayeeName, upiPending: null }, p.byAccountId)
    return { ...settings, upiId: p.upiId, upiPayeeName: p.upiPayeeName, upiPending: null }
  }
  return settings
}

export async function setSettings(patch: Partial<Settings>, byAccountId?: string) {
  for (const [key, value] of Object.entries(patch)) {
    await prisma.setting.upsert({
      where: { key },
      update: { value: value as never, updatedBy: byAccountId },
      create: { key, value: value as never, updatedBy: byAccountId },
    })
  }
}
