// Coach home: today's classes with counts, one tap to roster and scanner (COA-1)
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { addDays, api, fmtTime, istToday } from '../api'
import { PasswordChange } from '../admin/Settings'
import { Button, Card, Empty, ErrorNote, Loading, PageHead, Pill, useLoad } from '../ui'

export type StaffClass = {
  id: string
  title: string
  program: string
  programId: string
  coach: string
  coachId: string
  seriesId: string | null
  startsAt: string
  durationMin: number
  mode: 'ONLINE' | 'OFFLINE'
  locationOrLink: string
  capacity: number
  status: string
  notes: string | null
  booked: number
  checkedIn: number
}

export default function CoachHome() {
  const [day, setDay] = useState(istToday())
  const { data, error, loading } = useLoad(() => api.get<{ classes: StaffClass[] }>(`/staff/classes?from=${day}&days=1`), [day])
  const today = istToday()
  const [pw, setPw] = useState(false)
  return (
    <div>
      <PageHead
        title={day === today ? 'Today' : new Date(`${day}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' })}
        sub="Open a class to see the roster, scan or show the class code"
        action={<Link to="/app/coach/timetable" className="ab ab--ghost ab--sm">Timetable</Link>}
      />
      <div className="daychips" role="tablist" aria-label="Day">
        {Array.from({ length: 7 }, (_, i) => addDays(today, i - 1)).map((d) => (
          <button key={d} role="tab" aria-selected={d === day} className={d === day ? 'on' : ''} onClick={() => setDay(d)}>
            <small>{d === today ? 'Today' : new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' })}</small>
            <strong>{Number(d.slice(8))}</strong>
          </button>
        ))}
      </div>
      <ErrorNote error={error} />
      {loading && !data ? (
        <Loading />
      ) : !data?.classes.length ? (
        <Empty title="No classes on this day">
          Set up your weekly classes in the <Link to="/app/coach/timetable">timetable</Link>.
        </Empty>
      ) : (
        <ul className="clist">
          {data.classes.map((c) => (
            <li key={c.id}>
              <Link to={`/app/coach/class/${c.id}`} className="acard cls cls--link">
                <div className="cls__time">
                  <strong>{fmtTime(c.startsAt)}</strong>
                  <small>{c.durationMin} min</small>
                </div>
                <div className="cls__body">
                  <div className="cls__tags">
                    <Pill status={c.mode} />
                    {c.status !== 'SCHEDULED' && <Pill status={c.status} />}
                  </div>
                  <h3>{c.title}</h3>
                  <p className="muted">
                    {c.program} · {c.coach}
                  </p>
                </div>
                <div className="cls__count">
                  <strong>
                    {c.checkedIn}/{c.booked}
                  </strong>
                  <small className="muted">in / booked</small>
                  <small className="muted">cap {c.capacity}</small>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Card className="tip">
        <strong>Weak signal at the studio?</strong>
        <p className="muted small">Open each class once while you have signal. The roster is saved so scanning keeps working offline.</p>
      </Card>
      <Button variant="quiet" size="sm" onClick={() => setPw(true)}>
        Change my password
      </Button>
      {pw && <PasswordChange onClose={() => setPw(false)} />}
    </div>
  )
}
