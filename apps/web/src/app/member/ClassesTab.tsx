// Timetable and bookings (CLS-3, CLS-4, BKG-1 to BKG-8, ATT-8, ATT-9)
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { addDays, api, fmtTime, istDayOf, istToday } from '../api'
import { ProfileSwitcher, useProfile } from '../App'
import { useSession } from '../session'
import { Button, Card, Check, Empty, ErrorNote, Field, Loading, PageHead, Pill, Sheet, useAction, useLoad } from '../ui'

type Cls = {
  id: string
  title: string
  program: { id: string; name: string; audience: 'KIDS' | 'ADULTS' | 'MIXED' }
  coach: string
  startsAt: string
  durationMin: number
  mode: 'ONLINE' | 'OFFLINE'
  location: string | null
  link: string | null
  spotsLeft: number
  myBookings: { id: string; profileId: string; status: string }[]
  myWaitlist: string[]
}

type Summary = { plans: { planName: string; status: string; creditsLeft: number | null; weekLeft: number | null; end: string; makeupCredits: number }[] }

export default function ClassesTab() {
  const { me } = useSession()
  const { profileId } = useProfile()
  const profile = me!.profiles.find((p) => p.id === profileId)
  const today = istToday()
  const [day, setDay] = useState(today)
  const { data, error, loading, reload } = useLoad(() => api.get<{ classes: Cls[] }>('/classes?days=14'))
  const summary = useLoad(() => (profileId ? api.get<Summary>(`/classes/profiles/${profileId}/summary`) : Promise.resolve(null)), [profileId])
  const { busy, run } = useAction()
  const [multi, setMulti] = useState<Cls | null>(null)
  const [codeFor, setCodeFor] = useState<Cls | null>(null)

  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i))
  const fits = (c: Cls, kind?: string) => c.program.audience === 'MIXED' || (c.program.audience === 'KIDS' ? kind === 'CHILD' : kind === 'ADULT')
  const list = useMemo(() => (data?.classes ?? []).filter((c) => istDayOf(c.startsAt) === day && fits(c, profile?.kind)), [data, day, profile])
  const siblings = me!.profiles.filter((p) => p.kind === 'CHILD')
  // Before the early return below: hooks must run in the same order on every render
  const [note, setNote] = useState<string | null>(null)
  const nextDay = useMemo(() => days.find((d) => d !== day && (data?.classes ?? []).some((c) => istDayOf(c.startsAt) === d && fits(c, profile?.kind))), [data, day, profile])

  if (!profile)
    return (
      <Empty
        title="No one to book for yet"
        action={
          <Link className="ab ab--primary ab--sm" to="/app/me">
            Add yourself or a child
          </Link>
        }
      >
        Add the person who trains, then book their classes here.
      </Empty>
    )

  const book = (c: Cls, ids: string[]) =>
    run('book' + c.id, async () => {
      const r = await api.post<{ results: { ok: boolean; message?: string; profileId: string }[] }>(`/classes/${c.id}/book`, { profileIds: ids })
      const failed = r.results.filter((x) => !x.ok)
      await Promise.all([reload(), summary.reload()])
      if (failed.length) throw new Error(failed.map((f) => f.message).join('. '))
    }, 'Booked! See you there.')

  const cancel = (bookingId: string) =>
    run('cancel' + bookingId, async () => {
      const r = await api.post<{ returned: boolean }>(`/classes/bookings/${bookingId}/cancel`)
      await Promise.all([reload(), summary.reload()])
      return r
    }).then((r) => r && alertReturned(r.returned))

  const alertReturned = (returned: boolean) => setNote(returned ? 'Cancelled. The class is back on your plan.' : 'Cancelled. This was within the cancellation window, so the class is used.')

  const plan = summary.data?.plans.find((p) => p.status !== 'DUE') ?? summary.data?.plans[0]

  return (
    <div>
      <PageHead title="Classes" sub={plan ? <PlanLine plan={plan} /> : summary.loading ? ' ' : <span>No active plan. <Link to="/app/pay">Choose a plan</Link> to book.</span>} />
      <ProfileSwitcher />
      <div className="daychips" role="tablist" aria-label="Day">
        {days.map((d) => (
          <button key={d} role="tab" aria-selected={d === day} className={d === day ? 'on' : ''} onClick={() => setDay(d)}>
            <small>{d === today ? 'Today' : new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' })}</small>
            <strong>{Number(d.slice(8))}</strong>
          </button>
        ))}
      </div>
      {note && (
        <p className="anote" role="status">
          {note}
        </p>
      )}
      <ErrorNote error={error} />
      {loading && !data ? (
        <Loading />
      ) : list.length === 0 ? (
        <Empty
          title="No classes this day"
          action={
            nextDay && (
              <Button size="sm" variant="ghost" onClick={() => setDay(nextDay)}>
                Show {new Date(`${nextDay}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'long', timeZone: 'UTC' })}
              </Button>
            )
          }
        >
          {nextDay ? 'The next classes you can book are on another day this week.' : `No ${profile.kind === 'CHILD' ? 'kids' : 'adult'} classes are open this week yet. New classes are added up to 4 weeks ahead.`}
        </Empty>
      ) : (
        <ul className="clist">
          {list.map((c) => {
            const mine = c.myBookings.find((b) => b.profileId === profile.id)
            const started = new Date(c.startsAt).getTime() <= Date.now()
            const codeOpen = c.mode === 'ONLINE' && mine && Date.now() > new Date(c.startsAt).getTime() - 10 * 60_000 && Date.now() < new Date(c.startsAt).getTime() + 20 * 60_000
            const waiting = c.myWaitlist.includes(profile.id)
            return (
              <li key={c.id}>
                <Card className="cls">
                  <div className="cls__time">
                    <strong>{fmtTime(c.startsAt)}</strong>
                    <small>{c.durationMin} min</small>
                  </div>
                  <div className="cls__body">
                    <div className="cls__tags">
                      <Pill status={c.mode} />
                      {mine && <Pill status={mine.status} />}
                    </div>
                    <h3>{c.title}</h3>
                    <p className="muted">
                      {c.program.name} · {c.coach}
                      {c.location ? ` · ${c.location}` : ''}
                    </p>
                    <p className="cls__spots">{c.spotsLeft > 0 ? `${c.spotsLeft} spots left` : 'Full'}</p>
                  </div>
                  <div className="cls__act">
                    {mine && mine.status === 'ATTENDED' ? (
                      <span className="muted">Checked in ✓</span>
                    ) : mine ? (
                      <>
                        {c.link && (
                          <a className="ab ab--primary ab--sm" href={c.link} target="_blank" rel="noreferrer" onClick={() => void api.post('/attendance/joined', { classId: c.id, profileId: profile.id })}>
                            Join
                          </a>
                        )}
                        {codeOpen && (
                          <Button size="sm" variant="ghost" onClick={() => setCodeFor(c)}>
                            Check in
                          </Button>
                        )}
                        {!started && mine.status === 'BOOKED' && (
                          <Button size="sm" variant="quiet" busy={busy === 'cancel' + mine.id} onClick={() => void cancel(mine.id)}>
                            Cancel
                          </Button>
                        )}
                      </>
                    ) : started ? (
                      <span className="muted">Started</span>
                    ) : c.spotsLeft > 0 ? (
                      <Button size="sm" busy={busy === 'book' + c.id} onClick={() => (c.program.audience !== 'ADULTS' && siblings.length > 1 && profile.kind === 'CHILD' ? setMulti(c) : void book(c, [profile.id]))}>
                        Book
                      </Button>
                    ) : waiting ? (
                      <Button size="sm" variant="quiet" onClick={() => run('wl', async () => { await api.del(`/classes/${c.id}/waitlist/${profile.id}`); await reload() }, 'Left the waitlist')}>
                        Leave waitlist
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => run('wl', async () => { await api.post(`/classes/${c.id}/waitlist`, { profileId: profile.id }); await reload() }, 'You are on the waitlist. We will book you if a spot opens.')}>
                        Waitlist
                      </Button>
                    )}
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}
      {multi && <MultiBook cls={multi} kids={siblings} onClose={() => setMulti(null)} onBook={(ids) => book(multi, ids).then(() => setMulti(null))} busy={busy === 'book' + multi.id} />}
      {codeFor && <CodeCheckIn cls={codeFor} profileId={profile.id} onClose={() => setCodeFor(null)} onDone={() => (setCodeFor(null), void reload())} />}
    </div>
  )
}

function PlanLine({ plan }: { plan: Summary['plans'][number] }) {
  const parts = [`${plan.planName}: `]
  if (plan.creditsLeft !== null) parts.push(`${plan.creditsLeft} classes left this cycle`)
  if (plan.weekLeft !== null) parts.push(`, ${plan.weekLeft} this week`)
  if (plan.creditsLeft === null) parts.push('unlimited classes')
  if (plan.makeupCredits) parts.push(` + ${plan.makeupCredits} make-up`)
  return (
    <span>
      {parts.join('')} <Pill status={plan.status} />
    </span>
  )
}

function MultiBook({ cls, kids, onClose, onBook, busy }: { cls: Cls; kids: { id: string; name: string }[]; onClose: () => void; onBook: (ids: string[]) => void; busy: boolean }) {
  const [ids, setIds] = useState<string[]>(kids.filter((k) => !cls.myBookings.some((b) => b.profileId === k.id)).map((k) => k.id))
  return (
    <Sheet title={`Book ${cls.title}`} onClose={onClose}>
      <p className="muted">Who is coming?</p>
      {kids.map((k) => (
        <Check key={k.id} label={k.name} checked={ids.includes(k.id)} disabled={cls.myBookings.some((b) => b.profileId === k.id)} onChange={(e) => setIds(e.target.checked ? [...ids, k.id] : ids.filter((x) => x !== k.id))} />
      ))}
      <Button block busy={busy} disabled={!ids.length} onClick={() => onBook(ids)}>
        Book {ids.length} {ids.length === 1 ? 'place' : 'places'}
      </Button>
    </Sheet>
  )
}

function CodeCheckIn({ cls, profileId, onClose, onDone }: { cls: Cls; profileId: string; onClose: () => void; onDone: () => void }) {
  const [code, setCode] = useState('')
  const { busy, run } = useAction()
  return (
    <Sheet title="Check in" onClose={onClose}>
      <p className="muted">Type the 4-digit code your coach is showing for {cls.title}.</p>
      <Field label="Class code" inputMode="numeric" maxLength={4} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />
      <Button block busy={!!busy} disabled={code.length !== 4} onClick={() => run('code', () => api.post('/attendance/code', { classId: cls.id, profileId, code }), 'Checked in. Have a great class!').then((r) => r && onDone())}>
        Check in
      </Button>
    </Sheet>
  )
}
