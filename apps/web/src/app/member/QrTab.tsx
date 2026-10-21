// Check-in QR: refreshes every minute; keeps a day pass for when the phone is offline (ATT-1, 9.1, 9.2)
import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { ProfileSwitcher, useProfile } from '../App'
import { useSession } from '../session'
import { Card, Empty, PageHead } from '../ui'

type Tok = { token: string; expiresAt: number; dayPass: string; dayPassExpiresAt: number }

const store = {
  get: (id: string): Tok | null => {
    try {
      return JSON.parse(localStorage.getItem(`unifit-pass-${id}`) ?? 'null')
    } catch {
      return null
    }
  },
  set: (id: string, t: Tok) => {
    try {
      localStorage.setItem(`unifit-pass-${id}`, JSON.stringify(t))
    } catch {
      /* not critical */
    }
  },
}

export default function QrTab() {
  const { me } = useSession()
  const { profileId } = useProfile()
  const profile = me!.profiles.find((p) => p.id === profileId)
  const [img, setImg] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [left, setLeft] = useState(0)

  useEffect(() => {
    if (!profileId) return
    let stop = false
    let expires = 0
    const load = async () => {
      let token: string | null = null
      try {
        const t = await api.get<Tok>(`/attendance/token/${profileId}`)
        store.set(profileId, t)
        token = t.token
        expires = t.expiresAt
        setOffline(false)
      } catch {
        const saved = store.get(profileId)
        if (saved && saved.dayPassExpiresAt > Date.now()) {
          token = saved.dayPass
          expires = saved.dayPassExpiresAt
        }
        setOffline(true)
      }
      if (stop) return
      setImg(token ? await QRCode.toDataURL(token, { margin: 1, width: 560, errorCorrectionLevel: 'M', color: { dark: '#0B1F3F', light: '#FFFFFF' } }) : null)
    }
    void load()
    const refresh = setInterval(load, 60_000)
    const tick = setInterval(() => setLeft(Math.max(0, Math.round((expires - Date.now()) / 1000))), 1000)
    return () => {
      stop = true
      clearInterval(refresh)
      clearInterval(tick)
    }
  }, [profileId])

  if (!profile)
    return (
      <Empty
        title="No one added yet"
        action={
          <Link className="ab ab--primary ab--sm" to="/app/me">
            Add yourself or a child
          </Link>
        }
      >
        Each person who trains gets their own check-in QR to show at the studio door.
      </Empty>
    )
  return (
    <div className="qrpage">
      <PageHead title="My QR" sub="Show this at the studio door" />
      <ProfileSwitcher />
      <Card className="qrcard">
        <div className="qrcard__who">
          <strong>{profile.name}</strong>
          <span className="muted">{profile.memberCode}</span>
        </div>
        {img ? <img src={img} alt={`Check-in QR code for ${profile.name}`} className="qrcard__img" /> : <div className="qrcard__img qrcard__img--none">No pass saved. Connect to the internet once to get one.</div>}
        {offline ? (
          <p className="qrcard__state qrcard__state--off">Offline pass · valid until midnight</p>
        ) : (
          <p className="qrcard__state">Refreshes automatically{left ? ` · ${left}s` : ''}</p>
        )}
      </Card>
      <p className="muted center small">Screenshots stop working after a minute, so please show the live code.</p>
    </div>
  )
}
