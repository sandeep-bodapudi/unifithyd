// Render's free plan stops a service after 15 minutes without inbound requests. A request to our
// own public URL goes through Render's proxy and counts as inbound, so pinging every 10 minutes keeps
// the service (and the 5-minute jobs) running. It cannot wake a service that is already asleep:
// it starts again on the next visit or deploy, and this timer starts with it.
import { env } from './env'

const EVERY_MS = 10 * 60_000

export function startKeepAwake() {
  const base = env.KEEP_AWAKE_URL ?? env.RENDER_EXTERNAL_URL
  if (!base) {
    console.warn('[keep-awake] KEEP_AWAKE=true but no public URL (KEEP_AWAKE_URL or RENDER_EXTERNAL_URL); not pinging')
    return
  }
  const url = new URL('/api/health', base).toString()
  const ping = async () => {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
      if (!res.ok) console.warn(`[keep-awake] ${url} answered ${res.status}`)
    } catch (e) {
      console.warn(`[keep-awake] ${url} failed: ${(e as Error).message}`)
    }
  }
  setInterval(() => void ping(), EVERY_MS)
  console.log(`[keep-awake] pinging ${url} every ${EVERY_MS / 60_000} minutes`)
}
