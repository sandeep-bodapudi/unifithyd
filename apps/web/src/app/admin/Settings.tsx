// ADM-7, PAY-1 to PAY-3, BILL-3: studio rules, UPI with re-authentication, GST, plans
import { useState } from 'react'
import { api, rupees } from '../api'
import { useSession } from '../session'
import { Button, Card, Check, ErrorNote, Field, Loading, PageHead, Pill, Select, Sheet, useAction, useLoad } from '../ui'

type S = {
  studioName: string
  cancellationCutoffHours: number
  reminderHoursBefore: number
  graceDays: number
  blockIfDue: boolean
  upiId: string | null
  upiPayeeName: string | null
  upiPending: { upiId: string; upiPayeeName: string; effectiveAt: string } | null
  gstEnabled: boolean
  gstNumber: string | null
  gstRatePercent: number
}
type Plan = { id: string; name: string; shortCode: string; pricePaise: number; cycleMonths: number; creditsPerCycle: number | null; weeklyCap: number | null; audience: string; public: boolean; active: boolean; programs: { id: string; name: string }[] }

export default function Settings() {
  const { me } = useSession()
  const owner = me!.account.roles.includes('OWNER')
  const { data, error, loading, reload } = useLoad(() => api.get<{ settings: S }>('/admin/settings'))
  const plans = useLoad(() => api.get<{ plans: Plan[]; programs: { id: string; name: string }[] }>('/admin/plans'))
  const [upi, setUpi] = useState(false)
  const [plan, setPlan] = useState<Plan | 'new' | null>(null)
  const [pw, setPw] = useState(false)
  const { busy, run } = useAction()
  const [rules, setRules] = useState<Partial<S>>({})
  if (loading && !data) return <Loading />
  if (!data) return <ErrorNote error={error} />
  const s = { ...data.settings, ...rules }
  const save = (patch: Partial<S>) => run('save', async () => { await api.patch('/admin/settings', patch); setRules({}); await reload() }, 'Settings saved')

  return (
    <div>
      <PageHead title="Settings" />
      <Card>
        <h2 className="h3">Payment details (UPI)</h2>
        {data.settings.upiId ? (
          <p>
            <strong>{data.settings.upiPayeeName}</strong> · <code>{data.settings.upiId}</code>
          </p>
        ) : (
          <p className="aerror">Not set. Members see "payment details coming soon".</p>
        )}
        {data.settings.upiPending && (
          <div className="anote anote--warn">
            Changing to <code>{data.settings.upiPending.upiId}</code> ({data.settings.upiPending.upiPayeeName}) at {new Date(data.settings.upiPending.effectiveAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}.
            {owner && (
              <Button size="sm" variant="danger" busy={busy === 'cancelupi'} onClick={() => run('cancelupi', async () => { await api.post('/admin/settings/upi/cancel'); await reload() }, 'UPI change cancelled')}>
                Stop this change
              </Button>
            )}
          </div>
        )}
        <p className="muted small">Use a business or merchant UPI ID. Changes need your password and a code, alert every admin, and go live after 15 minutes (immediately for the owner).</p>
        <Button size="sm" variant="ghost" onClick={() => setUpi(true)}>
          Change UPI details
        </Button>
      </Card>

      <Card>
        <h2 className="h3">Studio rules</h2>
        <div className="arow2">
          <Field label="Studio name" value={s.studioName} onChange={(e) => setRules({ ...rules, studioName: e.target.value })} />
          <Field label="Free cancellation until (hours before)" type="number" min={0} max={48} value={s.cancellationCutoffHours} onChange={(e) => setRules({ ...rules, cancellationCutoffHours: Number(e.target.value) })} />
        </div>
        <div className="arow2">
          <Field label="Reminder (hours before class)" type="number" min={1} max={24} value={s.reminderHoursBefore} onChange={(e) => setRules({ ...rules, reminderHoursBefore: Number(e.target.value) })} />
          <Field label="Grace days after expiry" type="number" min={0} max={14} value={s.graceDays} onChange={(e) => setRules({ ...rules, graceDays: Number(e.target.value) })} />
        </div>
        <Check label="Block check-in for members who are Due (otherwise warn only)" checked={s.blockIfDue} onChange={(e) => setRules({ ...rules, blockIfDue: e.target.checked })} />
        <Button size="sm" busy={busy === 'save'} disabled={!Object.keys(rules).length} onClick={() => save({ studioName: s.studioName, cancellationCutoffHours: s.cancellationCutoffHours, reminderHoursBefore: s.reminderHoursBefore, graceDays: s.graceDays, blockIfDue: s.blockIfDue })}>
          Save rules
        </Button>
      </Card>

      <Card>
        <h2 className="h3">GST</h2>
        <p className="muted small">Leave off until your accountant confirms. Turning it on changes future receipts only.</p>
        <div className="arow2">
          <Field label="GSTIN" value={s.gstNumber ?? ''} onChange={(e) => setRules({ ...rules, gstNumber: e.target.value.toUpperCase() || null })} />
          <Field label="Rate %" type="number" value={s.gstRatePercent} onChange={(e) => setRules({ ...rules, gstRatePercent: Number(e.target.value) })} />
        </div>
        <Check label="Show GST on receipts (tax invoice)" checked={s.gstEnabled} onChange={(e) => setRules({ ...rules, gstEnabled: e.target.checked })} />
        <Button size="sm" busy={busy === 'save'} disabled={!('gstEnabled' in rules || 'gstNumber' in rules || 'gstRatePercent' in rules)} onClick={() => save({ gstEnabled: s.gstEnabled, gstNumber: s.gstNumber, gstRatePercent: s.gstRatePercent })}>
          Save GST
        </Button>
      </Card>

      <Card>
        <div className="arow arow--between">
          <h2 className="h3">Plans</h2>
          <Button size="sm" variant="ghost" onClick={() => setPlan('new')}>
            + New plan
          </Button>
        </div>
        <ul className="mini">
          {plans.data?.plans.map((p) => (
            <li key={p.id}>
              <span>
                <strong>{p.name}</strong> <code>{p.shortCode}</code> · {rupees(p.pricePaise)} / {p.cycleMonths === 1 ? 'month' : `${p.cycleMonths} months`} · {p.creditsPerCycle ? `${p.creditsPerCycle} a cycle` : 'unlimited'}
                {p.weeklyCap ? `, ${p.weeklyCap} a week` : ''} · {p.programs.map((x) => x.name).join(', ')} {!p.active && <Pill status="CANCELLED" label="Inactive" />} {!p.public && <Pill status="NONE" label="Hidden on website" />}
              </span>
              <button className="alink small" onClick={() => setPlan(p)}>
                Edit
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="h3">Your password</h2>
        <Button size="sm" variant="ghost" onClick={() => setPw(true)}>
          Change password
        </Button>
      </Card>

      {upi && <UpiChange onClose={() => setUpi(false)} onDone={() => (setUpi(false), void reload())} />}
      {plan && plans.data && <PlanForm plan={plan === 'new' ? null : plan} programs={plans.data.programs} onClose={() => setPlan(null)} onDone={() => (setPlan(null), void plans.reload())} />}
      {pw && <PasswordChange onClose={() => setPw(false)} />}
    </div>
  )
}

function UpiChange({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [step, setStep] = useState<1 | 2>(1)
  const [password, setPassword] = useState('')
  const [f, setF] = useState({ code: '', upiId: '', upiPayeeName: '' })
  const [dev, setDev] = useState<string | null>(null)
  const { busy, run } = useAction()
  return (
    <Sheet title="Change UPI details" onClose={onClose}>
      {step === 1 ? (
        <>
          <p className="muted">For safety, confirm your password first. We will email you a code.</p>
          <Field label="Your password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button block busy={!!busy} onClick={() => run('s', () => api.post<{ devCode?: string }>('/admin/settings/upi/start', { password })).then((r) => r && (setDev(r.devCode ?? null), setStep(2)))}>
            Continue
          </Button>
        </>
      ) : (
        <>
          <Field label="Code from your email" inputMode="numeric" maxLength={6} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.replace(/\D/g, '') })} hint={dev ? `Test code: ${dev}` : undefined} />
          <Field label="UPI ID" placeholder="name@bank" value={f.upiId} onChange={(e) => setF({ ...f, upiId: e.target.value.trim() })} />
          <Field label="Payee name (as shown in UPI apps)" value={f.upiPayeeName} onChange={(e) => setF({ ...f, upiPayeeName: e.target.value })} />
          <p className="muted small">Double-check the UPI ID by sending ₹1 to it from your own phone before saving.</p>
          <Button block busy={!!busy} onClick={() => run('u', () => api.post<{ effectiveAt: string }>('/admin/settings/upi', f)).then((r) => r && (alert(`Saved. Live from ${new Date(r.effectiveAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}. All admins were alerted.`), onDone()))}>
            Save UPI details
          </Button>
        </>
      )}
    </Sheet>
  )
}

function PlanForm({ plan, programs, onClose, onDone }: { plan: Plan | null; programs: { id: string; name: string }[]; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({
    name: plan?.name ?? '',
    shortCode: plan?.shortCode ?? '',
    price: plan ? String(plan.pricePaise / 100) : '',
    cycleMonths: plan?.cycleMonths ?? 1,
    creditsPerCycle: plan?.creditsPerCycle ? String(plan.creditsPerCycle) : '',
    weeklyCap: plan?.weeklyCap ? String(plan.weeklyCap) : '',
    audience: plan?.audience ?? 'ADULTS',
    public: plan?.public ?? true,
    active: plan?.active ?? true,
    programIds: plan?.programs.map((p) => p.id) ?? [],
  })
  const { busy, run } = useAction()
  const body = { name: f.name, shortCode: f.shortCode, pricePaise: Math.round(Number(f.price) * 100), cycleMonths: f.cycleMonths, creditsPerCycle: f.creditsPerCycle ? Number(f.creditsPerCycle) : null, weeklyCap: f.weeklyCap ? Number(f.weeklyCap) : null, audience: f.audience, public: f.public, active: f.active, programIds: f.programIds }
  return (
    <Sheet title={plan ? `Edit ${plan.name}` : 'New plan'} onClose={onClose}>
      <div className="arow2">
        <Field label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Field label="Short code (UPI note)" value={f.shortCode} onChange={(e) => setF({ ...f, shortCode: e.target.value.toUpperCase() })} />
      </div>
      <div className="arow2">
        <Field label="Price (₹)" inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
        <Select label="Length" value={f.cycleMonths} onChange={(e) => setF({ ...f, cycleMonths: Number(e.target.value) })}>
          {[1, 3, 6, 12].map((m) => (
            <option key={m} value={m}>
              {m} month{m > 1 ? 's' : ''}
            </option>
          ))}
        </Select>
      </div>
      <div className="arow2">
        <Field label="Classes per month (blank = unlimited)" inputMode="numeric" value={f.creditsPerCycle} onChange={(e) => setF({ ...f, creditsPerCycle: e.target.value.replace(/\D/g, '') })} />
        <Field label="Classes per week (blank = no cap)" inputMode="numeric" value={f.weeklyCap} onChange={(e) => setF({ ...f, weeklyCap: e.target.value.replace(/\D/g, '') })} />
      </div>
      <Select label="Who" value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })}>
        <option value="KIDS">Kids</option>
        <option value="ADULTS">Adults</option>
        <option value="MIXED">Everyone</option>
      </Select>
      <fieldset className="afieldset">
        <legend>Programs covered</legend>
        {programs.map((p) => (
          <Check key={p.id} label={p.name} checked={f.programIds.includes(p.id)} onChange={(e) => setF({ ...f, programIds: e.target.checked ? [...f.programIds, p.id] : f.programIds.filter((x) => x !== p.id) })} />
        ))}
      </fieldset>
      <Check label="Show on the website" checked={f.public} onChange={(e) => setF({ ...f, public: e.target.checked })} />
      <Check label="Active (members can buy it)" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
      <Button block busy={!!busy} onClick={() => run('p', () => (plan ? api.patch(`/admin/plans/${plan.id}`, body) : api.post('/admin/plans', body)), 'Plan saved').then((r) => r && onDone())}>
        Save plan
      </Button>
    </Sheet>
  )
}

export function PasswordChange({ onClose }: { onClose: () => void }) {
  const [f, setF] = useState({ current: '', next: '' })
  const { busy, run } = useAction()
  return (
    <Sheet title="Change password" onClose={onClose}>
      <Field label="Current password" type="password" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} />
      <Field label="New password (10+ characters)" type="password" autoComplete="new-password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} />
      <Button block busy={!!busy} disabled={f.next.length < 10} onClick={() => run('pw', () => api.post('/staff/password', f), 'Password changed').then((r) => r && onClose())}>
        Save
      </Button>
    </Sheet>
  )
}
