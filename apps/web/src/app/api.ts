// Small fetch wrapper for the Unifit API: cookies, CSRF header, JSON, readable errors.
export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'unifit' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'OFFLINE', 'You seem to be offline. Check your connection and try again.')
  }
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null
  if (!res.ok) throw new ApiError(res.status, data?.error ?? 'ERROR', data?.message ?? 'Something went wrong. Please try again.')
  return data as T
}

export const api = {
  get: <T>(p: string) => request<T>('GET', p),
  post: <T>(p: string, b?: unknown) => request<T>('POST', p, b ?? {}),
  patch: <T>(p: string, b: unknown) => request<T>('PATCH', p, b),
  del: <T>(p: string) => request<T>('DELETE', p),
}

export type Role = 'MEMBER' | 'COACH' | 'ADMIN' | 'OWNER'

export type Me = {
  account: { id: string; name: string; email: string; phone: string; roles: Role[]; channelPref: string }
  profiles: { id: string; name: string; kind: 'ADULT' | 'CHILD'; memberCode: string; dob: string; needsConsent: boolean }[]
  coachPrograms: { id: string; name: string }[]
}

export const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
export const fmtWhen = (iso: string | Date) =>
  new Date(iso).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })
export const fmtTime = (iso: string | Date) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })
export const fmtDay = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
export const istToday = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10)
export const istDayOf = (iso: string | Date) => new Date(new Date(iso).getTime() + 330 * 60_000).toISOString().slice(0, 10)
export const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
export const isStaff = (roles: Role[]) => roles.some((r) => r !== 'MEMBER')
export const isAdmin = (roles: Role[]) => roles.includes('ADMIN') || roles.includes('OWNER')
