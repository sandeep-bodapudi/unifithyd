// One class: roster, scanner, class code, manual check-in, message, edit, cancel (ATT-2 to ATT-10, COA-3, CLS-6, CLS-7, KID-6)
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, fmtTime, fmtWhen, istDayOf } from '../api'
import { Button, Card, Empty, ErrorNote, Field, Loading, PageHead, Pill, Sheet, TextArea, useAction, useLoad } from '../ui'
import Scanner from './Scanner'
import { ClassForm } from './Timetable'

type Person = { profileId: string; name: string; memberCode: string; kind: string; bookingStatus: string | null; checkedInAt: string | null; method: string | null; payStatus: string }
type Roster = { class: { id: string; title: string; program: string; startsAt: string; durationMin: number; mode: 'ONLINE' | 'OFFLINE'; capacity: number; status: string; locationOrLink: string }; people: Person[] }

const cacheKey = (id: string) => `unifit-roster-${id}`

export default function ClassDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const [tab, setTab] = useState<'roster' | 'scan' | 'code'>('roster')
  const [publicKey, setPublicKey] = useState<string | null>(() => {
    try {
      return localStorage.getItem('unifit-qr-pub')
    } catch {
      return null
    }
  })
  const load = useCallback(async () => {
    try {
      const r = await api.get<Roster>(`/staff/classes/${id}/roster`)
      try {
        localStorage.setItem(cacheKey(id!), JSON.stringify(r))
      } catch {
        /* offline cache is best effort */
      }
      return r
    } catch (e) {
      const cached = localStorage.getItem(cacheKey(id!))
      if (cached) return JSON.parse(cached) as Roster
      throw e
    }
  }, [id])
  const { data, error, loading, reload } = useLoad(load, [load])
  const joined = useLoad(() => (data?.class.mode === 'ONLINE' ? api.get<{ profileIds: string[] }>(`/attendance/joined/${id}`) : Promise.resolve({ profileIds: [] })), [id, data?.class.mode])
  const { busy, run } = useAction()
  const [manual, setManual] = useState(false)
  const [message, setMessage] = useState(false)
  const [edit, setEdit] = useState(false)
  const [cancel, setCancel] = useState(false)

  useEffect(() => {
    api
      .get<{ publicKey: string }>('/attendance/public-key')
      .then((r) => {
        setPublicKey(r.publicKey)
        try {
          localStorage.setItem('unifit-qr-pub', r.publicKey)
        } catch {
          /* best effort */
        }
      })
      .catch(() => {})
  }, [])

  if (loading && !data) return <Loading />
  if (!data) return <ErrorNote error={error} />
  const c = data.class
  const inCount = data.people.filter((p) => p.checkedInAt).length
  const live = c.status === 'SCHEDULED'

  const remove = (p: Person) => confirm(`Remove ${p.name}'s check-in?`) && run('rm' + p.profileId, async () => { await api.del(`/attendance/${c.id}/${p.profileId}`); await reload() }, 'Check-in removed')
  const call = (p: Person) => run('call' + p.profileId, async () => { const r = await api.post<{ tel: string }>(`/staff/classes/${c.id}/call/${p.profileId}`); window.location.href = r.tel })

  return (
    <div>
      <PageHead
        title={c.title}
        sub={
          <>
            {fmtWhen(c.startsAt)} · {c.durationMin} min · {c.program} <Pill status={c.mode} /> {c.status !== 'SCHEDULED' && <Pill status={c.status} />}
          </>
        }
        action={
          <Button variant="ghost" size="sm" onClick={() => nav('/app/coach')}>
            Back
          </Button>
        }
      />
      <div className="seg" role="tablist">
        {(['roster', 'scan', 'code'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {t === 'roster' ? `Roster ${inCount}/${data.people.length}` : t === 'scan' ? 'Scan QR' : 'Class code'}
          </button>
        ))}
      </div>

      {tab === 'scan' && live && <Scanner classId={c.id} roster={data.people} publicKey={publicKey} onScanned={() => void reload()} />}
      {tab === 'code' && live && <ClassCode classId={c.id} startsAt={c.startsAt} />}
      {tab !== 'roster' && !live && <p className="anote">This class is {c.status.toLowerCase()}.</p>}

      {tab === 'roster' && (
        <>
          {!data.people.length ? (
            <Empty title="Nobody booked yet" />
          ) : (
            <ul className="roster">
              {data.people.map((p) => (
                <li key={p.profileId} className="acard roster__row">
                  <div>
                    <strong>{p.name}</strong> <span className="muted small">{p.memberCode}</span>
                    <div className="roster__tags">
                      {p.checkedInAt ? <Pill status="ATTENDED" label={`In ${fmtTime(p.checkedInAt)}${p.method && p.method !== 'QR' ? ` · ${p.method.toLowerCase().replace('_', ' ')}` : ''}`} /> : p.bookingStatus && <Pill status={p.bookingStatus} />}
                      <Pill status={p.payStatus} />
                      {joined.data?.profileIds.includes(p.profileId) && !p.checkedInAt && <Pill status="INFO" label="Joined link" />}
                    </div>
                  </div>
                  <div className="roster__act">
                    {!p.checkedInAt && live && (
                      <Button size="sm" variant="ghost" busy={busy === 'in' + p.profileId} onClick={() => run('in' + p.profileId, async () => { await api.post('/attendance/manual', { classId: c.id, profileId: p.profileId, reason: c.mode === 'ONLINE' ? 'Seen in online class' : 'Marked by coach' }); await reload() }, `${p.name} checked in`)}>
                        Mark in
                      </Button>
                    )}
                    {p.checkedInAt && (
                      <button className="alink small" onClick={() => remove(p)}>
                        Undo
                      </button>
                    )}
                    {p.kind === 'CHILD' && (
                      <button className="alink small" onClick={() => call(p)}>
                        Call parent
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="arow arow--wrap">
            {live && (
              <Button variant="ghost" size="sm" onClick={() => setManual(true)}>
                Find and check in
              </Button>
            )}
            {live && (
              <Button variant="ghost" size="sm" onClick={() => setMessage(true)}>
                Message class
              </Button>
            )}
            {live && (
              <Button variant="ghost" size="sm" onClick={() => setEdit(true)}>
                Edit class
              </Button>
            )}
            {live && (
              <Button variant="danger" size="sm" onClick={() => setCancel(true)}>
                Cancel class
              </Button>
            )}
          </div>
          {c.mode === 'ONLINE' && <p className="muted small">"Joined link" means the member opened the meeting link. Only the class code or your mark counts as attended.</p>}
        </>
      )}

      {manual && <ManualCheckIn classId={c.id} onClose={() => setManual(false)} onDone={() => (setManual(false), void reload())} />}
      {message && <MessageClass classId={c.id} onClose={() => setMessage(false)} />}
      {cancel && <CancelClass classId={c.id} onClose={() => setCancel(false)} onDone={() => (setCancel(false), void reload())} />}
      {edit && (
        <Sheet title="Edit this class" onClose={() => setEdit(false)}>
          <ClassForm
            initial={{ day: istDayOf(c.startsAt), time: new Date(c.startsAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }), title: c.title, durationMin: c.durationMin, mode: c.mode, locationOrLink: c.locationOrLink, capacity: c.capacity }}
            submitLabel="Save changes"
            editOnly
            onSubmit={async (v) => {
              await api.patch(`/staff/classes/${c.id}`, { title: v.title, day: v.day, time: v.time, durationMin: v.durationMin, mode: v.mode, locationOrLink: v.locationOrLink, capacity: v.capacity })
              setEdit(false)
              await reload()
            }}
          />
        </Sheet>
      )}
    </div>
  )
}

function ClassCode({ classId, startsAt }: { classId: string; startsAt: string }) {
  const [code, setCode] = useState<{ code: string; refreshInSec: number } | null>(null)
  const [left, setLeft] = useState(0)
  useEffect(() => {
    let t: number
    const get = async () => {
      const r = await api.get<{ code: string; refreshInSec: number }>(`/staff/classes/${classId}/code`).catch(() => null)
      setCode(r)
      setLeft(r?.refreshInSec ?? 10)
      t = window.setTimeout(get, ((r?.refreshInSec ?? 10) + 1) * 1000)
    }
    void get()
    const tick = setInterval(() => setLeft((x) => Math.max(0, x - 1)), 1000)
    return () => (clearTimeout(t), clearInterval(tick))
  }, [classId])
  const opens = new Date(startsAt).getTime() - 10 * 60_000
  const closes = new Date(startsAt).getTime() + 20 * 60_000
  return (
    <Card className="code">
      <p className="muted">Show this on your screen. Members type it in the app to check in.</p>
      <p className="code__digits" aria-live="polite">{code?.code ?? '····'}</p>
      <p className="muted small">New code in {left}s · open {fmtTime(new Date(opens))} to {fmtTime(new Date(closes))}</p>
    </Card>
  )
}

function ManualCheckIn({ classId, onClose, onDone }: { classId: string; onClose: () => void; onDone: () => void }) {
  const [q, setQ] = useState('')
  const [reason, setReason] = useState('')
  const [people, setPeople] = useState<{ profileId: string; name: string; memberCode: string }[]>([])
  const { busy, run } = useAction()
  useEffect(() => {
    if (q.trim().length < 2) return setPeople([])
    const t = setTimeout(() => api.get<{ people: typeof people }>(`/attendance/search?q=${encodeURIComponent(q.trim())}`).then((r) => setPeople(r.people)).catch(() => {}), 250)
    return () => clearTimeout(t)
  }, [q])
  return (
    <Sheet title="Find and check in" onClose={onClose}>
      <Field label="Name or member code" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      <Field label="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. phone battery dead" />
      <ul className="picklist">
        {people.map((p) => (
          <li key={p.profileId}>
            <span>
              {p.name} <span className="muted small">{p.memberCode}</span>
            </span>
            <span className="arow">
              <Button size="sm" variant="ghost" busy={busy === 'm' + p.profileId} disabled={reason.trim().length < 3} onClick={() => run('m' + p.profileId, async () => { const r = await api.post<{ result: string; message?: string }>('/attendance/manual', { classId, profileId: p.profileId, reason, walkIn: false }); if (r.result !== 'ok' && r.result !== 'already') throw new Error(r.message ?? 'Not booked'); onDone() }, 'Checked in')}>
                Check in
              </Button>
              <Button size="sm" variant="quiet" busy={busy === 'w' + p.profileId} disabled={reason.trim().length < 3} onClick={() => run('w' + p.profileId, async () => { await api.post('/attendance/manual', { classId, profileId: p.profileId, reason, walkIn: true }); onDone() }, 'Walk-in added')}>
                Walk-in
              </Button>
            </span>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}

function MessageClass({ classId, onClose }: { classId: string; onClose: () => void }) {
  const [text, setText] = useState('')
  const { busy, run } = useAction()
  return (
    <Sheet title="Message everyone booked" onClose={onClose}>
      <TextArea label="Message" rows={4} maxLength={600} value={text} onChange={(e) => setText(e.target.value)} />
      <Button block busy={!!busy} disabled={text.trim().length < 3} onClick={() => run('msg', () => api.post<{ sent: number }>(`/staff/classes/${classId}/message`, { text })).then((r) => r && (alert(`Sent to ${r.sent} account${r.sent === 1 ? '' : 's'}`), onClose()))}>
        Send
      </Button>
    </Sheet>
  )
}

function CancelClass({ classId, onClose, onDone }: { classId: string; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('')
  const { busy, run } = useAction()
  return (
    <Sheet title="Cancel this class" onClose={onClose}>
      <p className="muted">Everyone booked is told, gets the class back, and members on limited plans get a make-up class.</p>
      <Field label="Reason (sent to members)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <Button variant="danger" block busy={!!busy} disabled={reason.trim().length < 3} onClick={() => run('c', () => api.post(`/staff/classes/${classId}/cancel`, { reason }), 'Class cancelled and members told').then((r) => r && onDone())}>
        Cancel class
      </Button>
      <ErrorNote error={null} />
    </Sheet>
  )
}
