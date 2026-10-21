// Weekly series, one-off classes and closures (CLS-1, CLS-2, CLS-5, CLS-8, COA-2)
import { useState } from 'react'
import { api, fmtDay, istToday, isAdmin } from '../api'
import { useSession } from '../session'
import { Button, Card, Check, Empty, ErrorNote, Field, Loading, PageHead, Pill, Select, Sheet, useAction, useLoad } from '../ui'

type Meta = { programs: { id: string; name: string; defaultCapacity: number }[]; coaches: { id: string; name: string }[] }
type Series = { id: string; title: string; weekdays: number[]; startTimeIst: string; durationMin: number; mode: 'ONLINE' | 'OFFLINE'; locationOrLink: string; capacity: number; fromDate: string; untilDate: string | null; program: { name: string }; coach: { name: string }; programId: string; coachId: string }

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export type ClassValues = { programId?: string; coachId?: string; title: string; day?: string; time: string; durationMin: number; mode: 'ONLINE' | 'OFFLINE'; locationOrLink: string; capacity: number; weekdays?: number[]; fromDate?: string; untilDate?: string | null }

export function ClassForm({ initial, meta, series, editOnly, submitLabel, onSubmit }: { initial: Partial<ClassValues>; meta?: Meta; series?: boolean; editOnly?: boolean; submitLabel: string; onSubmit: (v: ClassValues) => Promise<void> }) {
  const { me } = useSession()
  const [v, setV] = useState<ClassValues>({ title: '', time: '18:00', durationMin: 60, mode: 'OFFLINE', locationOrLink: 'Unifit Studio', capacity: 15, weekdays: [1, 3, 5], fromDate: istToday(), day: istToday(), untilDate: null, coachId: me!.account.id, ...initial })
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof ClassValues>(k: K, val: ClassValues[K]) => setV((x) => ({ ...x, [k]: val }))
  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await onSubmit(v)
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="aform">
      {!editOnly && meta && (
        <div className="arow2">
          <Select
            label="Program"
            value={v.programId ?? ''}
            onChange={(e) => {
              const p = meta.programs.find((x) => x.id === e.target.value)
              setV((x) => ({ ...x, programId: e.target.value, capacity: p?.defaultCapacity ?? x.capacity, title: x.title || p?.name || '' }))
            }}
          >
            <option value="">Choose…</option>
            {meta.programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Select label="Coach" value={v.coachId ?? ''} onChange={(e) => set('coachId', e.target.value)}>
            {meta.coaches.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      )}
      <Field label="Title" value={v.title} onChange={(e) => set('title', e.target.value)} />
      {series ? (
        <fieldset className="afieldset">
          <legend>Repeats on</legend>
          <div className="weekpick">
            {WEEK.map((w, i) => (
              <Check key={w} label={w} checked={v.weekdays!.includes(i + 1)} onChange={(e) => set('weekdays', e.target.checked ? [...v.weekdays!, i + 1] : v.weekdays!.filter((d) => d !== i + 1))} />
            ))}
          </div>
        </fieldset>
      ) : (
        <Field label="Date" type="date" value={v.day} onChange={(e) => set('day', e.target.value)} />
      )}
      <div className="arow2">
        <Field label="Start time (IST)" type="time" value={v.time} onChange={(e) => set('time', e.target.value)} />
        <Field label="Minutes" type="number" min={15} max={240} value={v.durationMin} onChange={(e) => set('durationMin', Number(e.target.value))} />
        <Field label="Capacity" type="number" min={1} max={200} value={v.capacity} onChange={(e) => set('capacity', Number(e.target.value))} />
      </div>
      <div className="arow2">
        <Select label="Mode" value={v.mode} onChange={(e) => set('mode', e.target.value as 'ONLINE' | 'OFFLINE')}>
          <option value="OFFLINE">Studio</option>
          <option value="ONLINE">Online</option>
        </Select>
        <Field label={v.mode === 'ONLINE' ? 'Meeting link (https://…)' : 'Location'} value={v.locationOrLink} onChange={(e) => set('locationOrLink', e.target.value)} />
      </div>
      {series && (
        <div className="arow2">
          <Field label="Starts from" type="date" value={v.fromDate} onChange={(e) => set('fromDate', e.target.value)} disabled={editOnly} />
          <Field label="Ends on (optional)" type="date" value={v.untilDate ?? ''} onChange={(e) => set('untilDate', e.target.value || null)} />
        </div>
      )}
      <ErrorNote error={error} />
      <Button block busy={busy} onClick={submit}>
        {submitLabel}
      </Button>
    </div>
  )
}

export default function Timetable() {
  const { me } = useSession()
  const admin = isAdmin(me!.account.roles)
  const meta = useLoad(() => api.get<Meta>('/staff/meta'))
  const series = useLoad(() => api.get<{ series: Series[] }>('/staff/series'))
  const closures = useLoad(() => api.get<{ closures: { id: string; fromDate: string; toDate: string; reason: string }[] }>('/staff/closures'))
  const [sheet, setSheet] = useState<null | 'series' | 'one' | 'closure' | Series>(null)
  const { busy, run } = useAction()

  if (meta.loading && !meta.data) return <Loading />
  return (
    <div>
      <PageHead
        title="Timetable"
        sub="Set up repeating classes once; they appear 4 weeks ahead automatically"
        action={
          <div className="arow">
            <Button size="sm" onClick={() => setSheet('series')}>
              + Weekly class
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSheet('one')}>
              + One-off
            </Button>
          </div>
        }
      />
      <ErrorNote error={series.error} />
      {series.loading && !series.data ? (
        <Loading />
      ) : !series.data?.series.length ? (
        <Empty
          title="No weekly classes yet"
          action={
            <Button size="sm" onClick={() => setSheet('series')}>
              Add weekly class
            </Button>
          }
        >
          Add each regular class once. It then appears 4 weeks ahead for members to book.
        </Empty>
      ) : (
        <ul className="clist">
          {series.data.series.map((s) => (
            <li key={s.id}>
              <Card className="cls">
                <div className="cls__time">
                  <strong>{s.startTimeIst}</strong>
                  <small>{s.durationMin} min</small>
                </div>
                <div className="cls__body">
                  <div className="cls__tags">
                    <Pill status={s.mode} />
                  </div>
                  <h3>{s.title}</h3>
                  <p className="muted">
                    {s.weekdays.map((d) => WEEK[d - 1]).join(', ')} · {s.program.name} · {s.coach.name} · cap {s.capacity}
                  </p>
                  <p className="muted small">
                    From {fmtDay(s.fromDate)}
                    {s.untilDate ? ` to ${fmtDay(s.untilDate)}` : ''}
                  </p>
                </div>
                <div className="cls__act">
                  <Button size="sm" variant="ghost" onClick={() => setSheet(s)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="quiet" busy={busy === s.id} onClick={() => confirm('End this weekly class? Future classes are cancelled and booked members are told.') && run(s.id, async () => { await api.del(`/staff/series/${s.id}`); await series.reload() }, 'Weekly class ended')}>
                    End
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <h2 className="h2">Studio closures</h2>
      {closures.data?.closures.length ? (
        <ul className="hist">
          {closures.data.closures.map((c) => (
            <li key={c.id} className="acard hist__row">
              <div>
                <strong>{c.reason}</strong>
                <p className="muted small">
                  {fmtDay(c.fromDate)}
                  {c.toDate !== c.fromDate ? ` to ${fmtDay(c.toDate)}` : ''}
                </p>
              </div>
              {admin && (
                <button className="alink" onClick={() => run('cl', async () => { await api.del(`/staff/closures/${c.id}`); await closures.reload() }, 'Closure removed')}>
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <Empty compact title="No upcoming closures">
          {admin ? 'Add a closure for holidays or maintenance. Classes on those days are cancelled and members are told.' : 'Holidays and other days the studio is shut appear here.'}
        </Empty>
      )}
      {admin && (
        <Button variant="ghost" size="sm" onClick={() => setSheet('closure')}>
          + Add closure
        </Button>
      )}

      {sheet === 'series' && meta.data && (
        <Sheet title="New weekly class" onClose={() => setSheet(null)}>
          <ClassForm initial={{}} meta={meta.data} series submitLabel="Create" onSubmit={async (v) => { await api.post('/staff/series', { programId: v.programId, coachId: v.coachId, title: v.title, weekdays: v.weekdays, time: v.time, durationMin: v.durationMin, mode: v.mode, locationOrLink: v.locationOrLink, capacity: v.capacity, fromDate: v.fromDate, untilDate: v.untilDate }); setSheet(null); await series.reload() }} />
        </Sheet>
      )}
      {sheet === 'one' && meta.data && (
        <Sheet title="One-off class" onClose={() => setSheet(null)}>
          <ClassForm initial={{}} meta={meta.data} submitLabel="Create" onSubmit={async (v) => { await api.post('/staff/classes', { programId: v.programId, coachId: v.coachId, title: v.title, day: v.day, time: v.time, durationMin: v.durationMin, mode: v.mode, locationOrLink: v.locationOrLink, capacity: v.capacity }); setSheet(null) }} />
        </Sheet>
      )}
      {sheet && typeof sheet === 'object' && (
        <Sheet title={`Edit ${sheet.title}`} onClose={() => setSheet(null)}>
          <p className="muted small">Changes apply to this and all future classes. Booked members are told about time, mode or place changes.</p>
          <ClassForm
            initial={{ ...sheet, time: sheet.startTimeIst }}
            series
            editOnly
            submitLabel="Save"
            onSubmit={async (v) => { await api.patch(`/staff/series/${sheet.id}`, { title: v.title, weekdays: v.weekdays, time: v.time, durationMin: v.durationMin, mode: v.mode, locationOrLink: v.locationOrLink, capacity: v.capacity, untilDate: v.untilDate }); setSheet(null); await series.reload() }}
          />
        </Sheet>
      )}
      {sheet === 'closure' && <ClosureForm onClose={() => setSheet(null)} onDone={() => (setSheet(null), void closures.reload())} />}
    </div>
  )
}

function ClosureForm({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ fromDate: istToday(), toDate: istToday(), reason: '' })
  const { busy, run } = useAction()
  return (
    <Sheet title="Studio closure" onClose={onClose}>
      <p className="muted">Classes on these days are cancelled, credits returned, make-up classes given and members told.</p>
      <div className="arow2">
        <Field label="From" type="date" value={f.fromDate} onChange={(e) => setF({ ...f, fromDate: e.target.value })} />
        <Field label="To" type="date" value={f.toDate} onChange={(e) => setF({ ...f, toDate: e.target.value })} />
      </div>
      <Field label="Reason" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="e.g. Diwali" />
      <Button block busy={!!busy} disabled={f.reason.length < 2} onClick={() => run('c', () => api.post<{ cancelled: number }>('/staff/closures', f)).then((r) => r && (alert(`${r.cancelled} classes cancelled`), onDone()))}>
        Add closure
      </Button>
    </Sheet>
  )
}
