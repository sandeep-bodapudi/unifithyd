import { createContext, lazy, Suspense, useContext, useEffect, useState, type ReactNode } from 'react'
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { LogoLockup, Mark } from '../brand/Logo'
import { ThemeToggle } from '../ThemeToggle'
import { api, isAdmin, isStaff, type Me } from './api'
import Login from './auth/Login'
import Register from './auth/Register'
import { SessionProvider, useSession } from './session'
import { Button, Check, Loading, Sheet, ToastProvider } from './ui'
import './app.css'

const ClassesTab = lazy(() => import('./member/ClassesTab'))
const QrTab = lazy(() => import('./member/QrTab'))
const PayTab = lazy(() => import('./member/PayTab'))
const MeTab = lazy(() => import('./member/MeTab'))
const CoachHome = lazy(() => import('./staff/CoachHome'))
const ClassDetail = lazy(() => import('./staff/ClassDetail'))
const Timetable = lazy(() => import('./staff/Timetable'))
const Dashboard = lazy(() => import('./admin/Dashboard'))
const Members = lazy(() => import('./admin/Members'))
const MemberDetail = lazy(() => import('./admin/MemberDetail'))
const Payments = lazy(() => import('./admin/Payments'))
const Leads = lazy(() => import('./admin/Leads'))
const Settings = lazy(() => import('./admin/Settings'))
const Staff = lazy(() => import('./admin/Staff'))
const Logs = lazy(() => import('./admin/Logs'))
const Reports = lazy(() => import('./admin/Reports'))
const Import = lazy(() => import('./admin/Import'))

// ---------- Selected profile (parents switch between children) ----------

type ProfileCtx = { profileId: string | null; setProfileId: (id: string) => void }
const PCtx = createContext<ProfileCtx>({ profileId: null, setProfileId: () => {} })
export const useProfile = () => useContext(PCtx)

function ProfileProvider({ me, children }: { me: Me; children: ReactNode }) {
  const read = () => {
    try {
      return localStorage.getItem('unifit-profile')
    } catch {
      return null
    }
  }
  const valid = (id: string | null) => (id && me.profiles.some((p) => p.id === id) ? id : (me.profiles[0]?.id ?? null))
  const [profileId, set] = useState<string | null>(() => valid(read()))
  useEffect(() => set((cur) => valid(cur)), [me]) // eslint-disable-line react-hooks/exhaustive-deps
  const setProfileId = (id: string) => {
    set(id)
    try {
      localStorage.setItem('unifit-profile', id)
    } catch {
      /* not critical */
    }
  }
  return <PCtx.Provider value={{ profileId, setProfileId }}>{children}</PCtx.Provider>
}

export function ProfileSwitcher() {
  const { me } = useSession()
  const { profileId, setProfileId } = useProfile()
  if (!me || me.profiles.length < 2) return null
  return (
    <div className="pswitch" role="tablist" aria-label="Who">
      {me.profiles.map((p) => (
        <button key={p.id} role="tab" aria-selected={p.id === profileId} className={p.id === profileId ? 'on' : ''} onClick={() => setProfileId(p.id)}>
          {p.name.split(' ')[0]}
        </button>
      ))}
    </div>
  )
}

// ---------- Consent gate (ACC-5, MIG-4) ----------

function ConsentGate({ me }: { me: Me }) {
  const { refresh } = useSession()
  const pending = me.profiles.filter((p) => p.needsConsent)
  const [ok, setOk] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!pending.length) return null
  return (
    <Sheet title="Please review our documents" onClose={() => {}}>
      <p className="muted">Before you continue, please accept the current Terms, Privacy Policy, Health Waiver and Refund Policy for {pending.map((p) => p.name).join(', ')}.</p>
      <Check checked={ok} onChange={(e) => setOk(e.target.checked)} label="I have read and accept these documents" />
      <Button
        block
        busy={busy}
        disabled={!ok}
        onClick={async () => {
          setBusy(true)
          await api.post('/auth/accept-documents', { profileIds: pending.map((p) => p.id), acceptTerms: true }).catch(() => {})
          await refresh()
          setBusy(false)
        }}
      >
        Accept and continue
      </Button>
    </Sheet>
  )
}

// ---------- Shells ----------

const icons = {
  classes: 'M4 6h16M4 12h16M4 18h10',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2',
  pay: 'M3 7h18v10H3zM3 11h18M7 15h3',
  me: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4-6 8-6s7 2 8 6',
  home: 'M3 11l9-7 9 7v9h-6v-6H9v6H3z',
  cal: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  people: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c1-4 3-6 7-6s6 2 7 6M17 11a3 3 0 1 0 0-6M22 20c-.5-3-2-5-5-5',
  money: 'M3 7h18v10H3zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  lead: 'M4 4h16v12H8l-4 4z',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  chart: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
  log: 'M6 3h9l5 5v13H6zM14 3v6h6M9 13h8M9 17h6',
  staff: 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2',
  upload: 'M12 3v12M7 8l5-5 5 5M4 17v4h16v-4',
}

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
)

type NavItem = { to: string; label: string; icon: keyof typeof icons; end?: boolean }

function Shell({ items, children, me }: { items: NavItem[]; children: ReactNode; me: Me }) {
  const { logout } = useSession()
  const nav = useNavigate()
  const staff = isStaff(me.account.roles)
  const loc = useLocation()
  const inStaff = loc.pathname.startsWith('/app/coach') || loc.pathname.startsWith('/app/admin')
  return (
    <div className="shell">
      <aside className="side">
        <div className="side__logo">
          <LogoLockup height={30} />
        </div>
        <nav className="side__nav" aria-label="Main">
          {items.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.end}>
              <Icon d={icons[i.icon]} />
              <span>{i.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="side__foot">
          {staff && me.profiles.length > 0 && (
            <button className="alink" onClick={() => nav(inStaff ? '/app/classes' : isAdmin(me.account.roles) ? '/app/admin' : '/app/coach')}>
              {inStaff ? 'Switch to member view' : 'Switch to staff view'}
            </button>
          )}
          <div className="side__me">
            <span>{me.account.name}</span>
            <ThemeToggle />
          </div>
          <button className="alink" onClick={() => logout().then(() => nav('/app/login'))}>
            Log out
          </button>
        </div>
      </aside>
      <header className="topbar">
        <Mark size={26} />
        <span className="topbar__title">{items.find((i) => (i.end ? loc.pathname === i.to : loc.pathname.startsWith(i.to)))?.label ?? 'Unifit'}</span>
        {staff && me.profiles.length > 0 && (
          <button className="alink topbar__switch" onClick={() => nav(inStaff ? '/app/classes' : isAdmin(me.account.roles) ? '/app/admin' : '/app/coach')}>
            {inStaff ? 'Member view' : 'Staff view'}
          </button>
        )}
        <ThemeToggle />
      </header>
      <main className="main">
        <Suspense fallback={<Loading />}>{children}</Suspense>
      </main>
      <nav className="tabbar" aria-label="Main">
        {items.slice(0, 5).map((i) => (
          <NavLink key={i.to} to={i.to} end={i.end}>
            <Icon d={icons[i.icon]} />
            <span>{i.label}</span>
          </NavLink>
        ))}
        {items.length > 5 && (
          <NavLink to="/app/admin/more">
            <Icon d="M5 12h.01M12 12h.01M19 12h.01" />
            <span>More</span>
          </NavLink>
        )}
      </nav>
    </div>
  )
}

const memberNav: NavItem[] = [
  { to: '/app/classes', label: 'Classes', icon: 'classes' },
  { to: '/app/qr', label: 'My QR', icon: 'qr' },
  { to: '/app/pay', label: 'Pay', icon: 'pay' },
  { to: '/app/me', label: 'Me', icon: 'me' },
]
const coachNav: NavItem[] = [
  { to: '/app/coach', label: 'Today', icon: 'home', end: true },
  { to: '/app/coach/timetable', label: 'Timetable', icon: 'cal' },
]
const adminNav: NavItem[] = [
  { to: '/app/admin', label: 'Dashboard', icon: 'home', end: true },
  { to: '/app/admin/members', label: 'Members', icon: 'people' },
  { to: '/app/admin/payments', label: 'Payments', icon: 'money' },
  { to: '/app/coach', label: 'Classes', icon: 'cal' },
  { to: '/app/admin/leads', label: 'Leads', icon: 'lead' },
  { to: '/app/admin/reports', label: 'Reports', icon: 'chart' },
  { to: '/app/admin/settings', label: 'Settings', icon: 'gear' },
  { to: '/app/admin/staff', label: 'Staff', icon: 'staff' },
  { to: '/app/admin/import', label: 'Import', icon: 'upload' },
  { to: '/app/admin/logs', label: 'Logs', icon: 'log' },
]

function More() {
  return (
    <div className="more">
      {adminNav.slice(5).map((i) => (
        <NavLink key={i.to} to={i.to} className="acard more__item">
          <Icon d={icons[i.icon]} />
          {i.label}
        </NavLink>
      ))}
    </div>
  )
}

function Authed() {
  const { me, loading } = useSession()
  const loc = useLocation()
  if (loading) return <Loading />
  if (!me) return <Navigate to="/app/login" replace state={{ from: loc.pathname }} />
  const admin = isAdmin(me.account.roles)
  const staff = isStaff(me.account.roles)
  const staffItems = admin ? adminNav : coachNav
  const home = admin ? '/app/admin' : staff ? '/app/coach' : '/app/classes'
  return (
    <ProfileProvider me={me}>
      <ConsentGate me={me} />
      <Routes>
        <Route index element={<Navigate to={home} replace />} />
        {['classes', 'qr', 'pay', 'me'].map((p) => (
          <Route
            key={p}
            path={p}
            element={
              <Shell items={memberNav} me={me}>
                {p === 'classes' ? <ClassesTab /> : p === 'qr' ? <QrTab /> : p === 'pay' ? <PayTab /> : <MeTab />}
              </Shell>
            }
          />
        ))}
        {staff && (
          <>
            <Route path="coach" element={<Shell items={staffItems} me={me}><CoachHome /></Shell>} />
            <Route path="coach/class/:id" element={<Shell items={staffItems} me={me}><ClassDetail /></Shell>} />
            <Route path="coach/timetable" element={<Shell items={staffItems} me={me}><Timetable /></Shell>} />
          </>
        )}
        {admin && (
          <>
            <Route path="admin" element={<Shell items={adminNav} me={me}><Dashboard /></Shell>} />
            <Route path="admin/members" element={<Shell items={adminNav} me={me}><Members /></Shell>} />
            <Route path="admin/members/:id" element={<Shell items={adminNav} me={me}><MemberDetail /></Shell>} />
            <Route path="admin/payments" element={<Shell items={adminNav} me={me}><Payments /></Shell>} />
            <Route path="admin/leads" element={<Shell items={adminNav} me={me}><Leads /></Shell>} />
            <Route path="admin/settings" element={<Shell items={adminNav} me={me}><Settings /></Shell>} />
            <Route path="admin/staff" element={<Shell items={adminNav} me={me}><Staff /></Shell>} />
            <Route path="admin/logs" element={<Shell items={adminNav} me={me}><Logs /></Shell>} />
            <Route path="admin/reports" element={<Shell items={adminNav} me={me}><Reports /></Shell>} />
            <Route path="admin/import" element={<Shell items={adminNav} me={me}><Import /></Shell>} />
            <Route path="admin/more" element={<Shell items={adminNav} me={me}><More /></Shell>} />
          </>
        )}
        <Route path="*" element={<Navigate to={home} replace />} />
      </Routes>
    </ProfileProvider>
  )
}

function Guest({ children }: { children: ReactNode }) {
  const { me, loading } = useSession()
  if (loading) return <Loading />
  if (me) return <Navigate to="/app" replace />
  return <>{children}</>
}

export default function MemberApp() {
  return (
    <SessionProvider>
      <ToastProvider>
        <Routes>
          <Route path="login" element={<Guest><Login /></Guest>} />
          <Route path="register" element={<Guest><Register /></Guest>} />
          <Route path="*" element={<Authed />} />
        </Routes>
      </ToastProvider>
    </SessionProvider>
  )
}
