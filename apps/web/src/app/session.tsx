import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, ApiError, type Me } from './api'

type Session = { me: Me | null; loading: boolean; refresh: () => Promise<void>; logout: () => Promise<void> }

const Ctx = createContext<Session>({ me: null, loading: true, refresh: async () => {}, logout: async () => {} })

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      setMe(await api.get<Me>('/auth/me'))
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setMe(null)
      else throw e
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => {})
    setMe(null)
  }, [])

  useEffect(() => {
    refresh().catch(() => setLoading(false))
  }, [refresh])

  return <Ctx.Provider value={{ me, loading, refresh, logout }}>{children}</Ctx.Provider>
}

export const useSession = () => useContext(Ctx)
