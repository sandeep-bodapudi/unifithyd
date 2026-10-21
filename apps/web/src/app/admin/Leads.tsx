// LEAD-2 to LEAD-5: leads, trial booking, follow-ups
import { useState } from 'react'
import { addDays, api, fmtDay, fmtWhen, istToday } from '../api'
import { Button, Card, Empty, ErrorNote, Field, Loading, PageHead, Pill, Select, Sheet, TextArea, useAction, useLoad } from '../ui'

type Lead = { id: string; name: string; phone: string; forChildAge: number | null; program: string; preferredTime: string | null; source: string; status: string; followUpOn: string | null; notes: string | null; createdAt: string }

export default function Leads() {
  const [status, setStatus] = useState('OPEN')
  const { data, error, loading, reload } = useLoad(() => api.get<{ leads: Lead[]; funnel: { source: string; status: string; count: number }[] }>(`/admin/leads?status=${status}`), [status])
  const [open, setOpen] = useState<Lead | null>(null)
  const [trial, setTrial] = useState<Lead | null>(null)
  const sources = [...new Set(data?.funnel.map((f) => f.source) ?? [])]
  return (
    <div>
      <PageHead title="Leads" sub="Trial sign-ups from the website and walk-ins" action={<Select label="Show" value={status} onChange={(e) => setStatus(e.target.value)}>{['OPEN', 'ALL', 'NEW', 'TRIAL_BOOKED', 'ATTENDED', 'JOINED', 'LOST'].map((s) => <option key={s} value={s}>{s === 'OPEN' ? 'Open' : s === 'ALL' ? 'All' : s.replace('_', ' ').toLowerCase()}</option>)}</Select>} />
      {sources.length > 0 && (
        <div className="kpis kpis--small">
          {sources.map((s) => {
            const rows = data!.funnel.filter((f) => f.source === s)
            const total = rows.reduce((a, r) => a + r.count, 0)
            const joined = rows.find((r) => r.status === 'JOINED')?.count ?? 0
            return (
              <Card key={s} className="kpi">
                <span className="kpi__v">
                  {joined}/{total}
                </span>
                <span className="kpi__l">{s}: joined / leads</span>
              </Card>
            )
          })}
        </div>
      )}
      <ErrorNote error={error} />
      {loading && !data ? (
        <Loading />
      ) : !data?.leads.length ? (
        status === 'OPEN' || status === 'ALL' ? (
          <Empty
            title={status === 'OPEN' ? 'No open leads' : 'No leads yet'}
            action={
              <a className="ab ab--ghost ab--sm" href="/#trial" target="_blank" rel="noreferrer">
                Open the trial form
              </a>
            }
          >
            People who ask for a free trial on the website appear here, so you can call them and book a class.
          </Empty>
        ) : (
          <Empty
            title={`No leads marked "${status.replace('_', ' ').toLowerCase()}"`}
            action={
              <Button size="sm" variant="ghost" onClick={() => setStatus('OPEN')}>
                Show open leads
              </Button>
            }
          >
            Try another status.
          </Empty>
        )
      ) : (
        <ul className="hist">
          {data.leads.map((l) => (
            <li key={l.id} className="acard hist__row">
              <div>
                <strong>{l.name}</strong> <Pill status={l.status} />
                <p className="muted small">
                  <a href={`tel:+91${l.phone}`}>{l.phone}</a> · {l.program}
                  {l.forChildAge ? ` · child aged ${l.forChildAge}` : ''} · {l.preferredTime ?? 'any time'} · {l.source} · {fmtWhen(l.createdAt)}
                </p>
                {l.followUpOn && <p className={`small ${l.followUpOn <= istToday() ? 'aerror' : 'muted'}`}>Follow up {fmtDay(l.followUpOn)}</p>}
                {l.notes && <p className="small">{l.notes}</p>}
              </div>
              <div className="arow arow--wrap">
                <a className="ab ab--ghost ab--sm" href={`https://wa.me/91${l.phone}`} target="_blank" rel="noreferrer">
                  WhatsApp
                </a>
                {l.status === 'NEW' && (
                  <Button size="sm" onClick={() => setTrial(l)}>
                    Book trial
                  </Button>
                )}
                <Button size="sm" variant="quiet" onClick={() => setOpen(l)}>
                  Update
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {open && <Update lead={open} onClose={() => setOpen(null)} onDone={() => (setOpen(null), void reload())} />}
      {trial && <Trial lead={trial} onClose={() => setTrial(null)} onDone={() => (setTrial(null), void reload())} />}
    </div>
  )
}

function Update({ lead, onClose, onDone }: { lead: Lead; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ status: lead.status, followUpOn: lead.followUpOn ?? addDays(istToday(), 2), notes: lead.notes ?? '' })
  const { busy, run } = useAction()
  return (
    <Sheet title={lead.name} onClose={onClose}>
      <Select label="Status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
        {['NEW', 'TRIAL_BOOKED', 'ATTENDED', 'JOINED', 'LOST'].map((s) => (
          <option key={s} value={s}>
            {s.replace('_', ' ').toLowerCase()}
          </option>
        ))}
      </Select>
      <Field label="Follow up on" type="date" value={f.followUpOn} onChange={(e) => setF({ ...f, followUpOn: e.target.value })} />
      <TextArea label="Notes" rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      <Button block busy={!!busy} onClick={() => run('u', () => api.patch(`/admin/leads/${lead.id}`, { ...f, followUpOn: f.followUpOn || null }), 'Saved').then((r) => r && onDone())}>
        Save
      </Button>
    </Sheet>
  )
}

function Trial({ lead, onClose, onDone }: { lead: Lead; onClose: () => void; onDone: () => void }) {
  const classes = useLoad(() => api.get<{ classes: { id: string; title: string; startsAt: string; program: string; mode: string; booked: number; capacity: number }[] }>(`/staff/classes?from=${istToday()}&days=14`))
  const [f, setF] = useState({ classId: '', email: '', childName: '', childDob: '' })
  const { busy, run } = useAction()
  const kids = lead.program === 'kids'
  const options = (classes.data?.classes ?? []).filter((c) => new Date(c.startsAt) > new Date() && c.booked < c.capacity && c.program !== 'Adult Training')
  return (
    <Sheet title={`Book a free trial for ${lead.name}`} onClose={onClose}>
      <Select label="Class" value={f.classId} onChange={(e) => setF({ ...f, classId: e.target.value })}>
        <option value="">Choose…</option>
        {options.map((c) => (
          <option key={c.id} value={c.id}>
            {fmtWhen(c.startsAt)} · {c.title} ({c.program}, {c.mode === 'ONLINE' ? 'online' : 'studio'})
          </option>
        ))}
      </Select>
      <Field label="Their email (for the account)" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      {kids && (
        <div className="arow2">
          <Field label="Child's name" value={f.childName} onChange={(e) => setF({ ...f, childName: e.target.value })} />
          <Field label="Child's date of birth" type="date" value={f.childDob} onChange={(e) => setF({ ...f, childDob: e.target.value })} />
        </div>
      )}
      <Button block busy={!!busy} disabled={!f.classId || !f.email} onClick={() => run('t', () => api.post(`/admin/leads/${lead.id}/trial`, { classId: f.classId, email: f.email, childName: f.childName || undefined, childDob: f.childDob || undefined }), 'Trial booked and confirmation sent').then((r) => r && onDone())}>
        Book trial
      </Button>
    </Sheet>
  )
}
