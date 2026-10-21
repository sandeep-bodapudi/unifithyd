// Profile, progress, weight log, family and privacy (FIT-1, FIT-2, ACC-7, KID-1, MSG-2)
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, fmtDay, fmtWhen, istToday } from '../api'
import { ProfileSwitcher, useProfile } from '../App'
import { useSession } from '../session'
import { Button, Card, Check, Empty, ErrorNote, Field, PageHead, Pill, Select, Sheet, useAction, useLoad } from '../ui'

type Summary = {
  plans: { planName: string; status: string; end: string; creditsLeft: number | null; weekLeft: number | null; makeupCredits: number }[]
  upcoming: number
  totalAttended: number
  thisMonth: number
  streakWeeks: number
  history: { id: string; status: string; title: string; startsAt: string; mode: string }[]
}

export default function MeTab() {
  const { me, refresh, logout } = useSession()
  const nav = useNavigate()
  const { profileId } = useProfile()
  const profile = me!.profiles.find((p) => p.id === profileId)
  const s = useLoad(() => (profileId ? api.get<Summary>(`/classes/profiles/${profileId}/summary`) : Promise.resolve(null)), [profileId])
  const [addChild, setAddChild] = useState(false)
  const [addSelf, setAddSelf] = useState(false)
  const { busy, run } = useAction()
  const hasSelf = me!.profiles.some((p) => p.kind === 'ADULT')

  return (
    <div>
      <PageHead title={me!.account.name} sub={me!.account.email} />
      <ProfileSwitcher />
      {profile && s.data && (
        <>
          <div className="stats">
            <Card className="stat">
              <span className="stat__n">{s.data.streakWeeks}</span>
              <span className="muted">week streak</span>
            </Card>
            <Card className="stat">
              <span className="stat__n">{s.data.thisMonth}</span>
              <span className="muted">this month</span>
            </Card>
            <Card className="stat">
              <span className="stat__n">{s.data.totalAttended}</span>
              <span className="muted">classes in all</span>
            </Card>
            <Card className="stat">
              <span className="stat__n">{s.data.upcoming}</span>
              <span className="muted">upcoming</span>
            </Card>
          </div>
          {s.data.plans.map((p) => (
            <Card key={p.planName} className="paystatus__item">
              <div>
                <strong>{p.planName}</strong>
                <p className="muted small">
                  Until {fmtDay(p.end)}
                  {p.creditsLeft !== null ? ` · ${p.creditsLeft} classes left this cycle` : ''}
                  {p.makeupCredits ? ` · ${p.makeupCredits} make-up` : ''}
                </p>
              </div>
              <Pill status={p.status} />
            </Card>
          ))}
          {!s.data.plans.length && (
            <Card>
              <Empty
                compact
                title={`No plan for ${profile.name.split(' ')[0]} yet`}
                action={
                  <Link className="ab ab--primary ab--sm" to="/app/pay">
                    Choose a plan
                  </Link>
                }
              >
                Pick a plan and pay by UPI to start booking classes.
              </Empty>
            </Card>
          )}
          {profile.kind === 'ADULT' && <Weights profileId={profile.id} />}
          <h2 className="h2">Recent classes</h2>
          {!s.data.history.length && (
            <Empty
              title="No classes yet"
              action={
                <Link className="ab ab--ghost ab--sm" to="/app/classes">
                  Book a class
                </Link>
              }
            >
              Classes you book and attend show here, with your streak above.
            </Empty>
          )}
          <ul className="hist">
            {s.data.history.slice(0, 8).map((h) => (
              <li key={h.id} className="acard hist__row">
                <div>
                  <strong>{h.title}</strong>
                  <p className="muted small">{fmtWhen(h.startsAt)}</p>
                </div>
                <Pill status={h.status} />
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className="h2">Family</h2>
      <Card>
        {!me!.profiles.length && <Empty compact title="No one added yet">Add yourself or your children to book classes and get a check-in QR.</Empty>}
        <ul className="family">
          {me!.profiles.map((p) => (
            <li key={p.id}>
              <strong>{p.name}</strong> <span className="muted">{p.memberCode} · {p.kind === 'CHILD' ? 'Child' : 'Adult'}</span>
            </li>
          ))}
        </ul>
        <div className="arow">
          <Button variant="ghost" size="sm" onClick={() => setAddChild(true)}>
            + Add a child
          </Button>
          {!hasSelf && (
            <Button variant="ghost" size="sm" onClick={() => setAddSelf(true)}>
              + I want to train too
            </Button>
          )}
        </div>
      </Card>

      <h2 className="h2">Settings</h2>
      <Card>
        <Select
          label="Send me updates by"
          value={me!.account.channelPref}
          onChange={(e) => run('chan', async () => { await api.patch('/auth/me', { channelPref: e.target.value }); await refresh() }, 'Saved')}
        >
          <option value="EMAIL">Email</option>
          <option value="WHATSAPP">WhatsApp (email until it is set up)</option>
          <option value="SMS">SMS (email until it is set up)</option>
        </Select>
        <div className="arow">
          <a className="ab ab--ghost ab--sm" href="/api/auth/export">
            Download my data
          </a>
          <Button variant="quiet" size="sm" busy={busy === 'del'} onClick={() => confirm('Ask the studio to delete your account and data? Payment records are kept for accounting.') && run('del', () => api.post('/auth/delete-request'), 'Request sent. The studio will complete it within 30 days.')}>
            Request deletion
          </Button>
        </div>
        <Button variant="ghost" block onClick={() => logout().then(() => nav('/app/login'))}>
          Log out
        </Button>
      </Card>

      {addChild && <AddChild onClose={() => setAddChild(false)} onDone={() => (setAddChild(false), void refresh())} />}
      {addSelf && <AddSelf onClose={() => setAddSelf(false)} onDone={() => (setAddSelf(false), void refresh())} />}
    </div>
  )
}

function Weights({ profileId }: { profileId: string }) {
  const w = useLoad(() => api.get<{ weights: { date: string; kg: number }[] }>(`/classes/profiles/${profileId}/weights`), [profileId])
  const [kg, setKg] = useState('')
  const { busy, run } = useAction()
  const pts = w.data?.weights ?? []
  const min = Math.min(...pts.map((p) => p.kg)) - 1
  const max = Math.max(...pts.map((p) => p.kg)) + 1
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${(i / Math.max(1, pts.length - 1)) * 300} ${80 - ((p.kg - min) / (max - min || 1)) * 70}`).join(' ')
  return (
    <Card className="weights">
      <div className="arow arow--between">
        <h2 className="h3">Weight</h2>
        <span className="muted small">Private to you</span>
      </div>
      {pts.length > 1 ? (
        <svg viewBox="0 0 300 90" className="weights__chart" role="img" aria-label={`Weight trend from ${pts[0].kg} to ${pts.at(-1)!.kg} kg`}>
          <path d={path} fill="none" stroke="var(--green)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      ) : (
        <p className="muted small">{pts.length ? 'Log one more entry to see your trend.' : 'No entries yet. Log your weight below to track your progress over time.'}</p>
      )}
      {pts.length > 0 && <p className="small">Latest: {pts.at(-1)!.kg} kg</p>}
      <div className="arow">
        <Field label="Today (kg)" inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value.replace(/[^\d.]/g, ''))} />
        <Button size="sm" busy={busy === 'w'} disabled={!Number(kg)} onClick={() => run('w', async () => { await api.post(`/classes/profiles/${profileId}/weights`, { date: istToday(), kg: Number(kg) }); setKg(''); await w.reload() }, 'Saved')}>
          Save
        </Button>
      </div>
    </Card>
  )
}

function AddChild({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState('')
  const [dob, setDob] = useState('')
  const [ok, setOk] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const { busy, run } = useAction()
  return (
    <Sheet title="Add a child" onClose={onClose}>
      <Field label="Child's full name" value={name} onChange={(e) => setName(e.target.value)} />
      <Field label="Date of birth" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
      <Check checked={ok} onChange={(e) => setOk(e.target.checked)} label="As parent or guardian, I accept the Terms, Privacy Policy, Health Waiver and Refund Policy for this child" />
      <ErrorNote error={error} />
      <Button block busy={!!busy} disabled={!ok} onClick={() => run('c', () => api.post('/auth/children', { name, dob, acceptTerms: ok }).catch((e) => (setError(e), Promise.reject(e))), 'Child added').then((r) => r && onDone())}>
        Add child
      </Button>
    </Sheet>
  )
}

function AddSelf({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [dob, setDob] = useState('')
  const [ok, setOk] = useState(false)
  const { busy, run } = useAction()
  return (
    <Sheet title="Train with us too" onClose={onClose}>
      <Field label="Your date of birth" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
      <Check checked={ok} onChange={(e) => setOk(e.target.checked)} label="I accept the Terms, Privacy Policy, Health Waiver and Refund Policy" />
      <Button block busy={!!busy} disabled={!ok || !dob} onClick={() => run('s', () => api.post('/auth/self-profile', { dob, acceptTerms: ok }), 'Your profile is ready').then((r) => r && onDone())}>
        Add me
      </Button>
    </Sheet>
  )
}
