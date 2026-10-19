// ADM-1, ADM-2
import { Link } from 'react-router-dom'
import { api, fmtTime, rupees } from '../api'
import { Card, Empty, ErrorNote, Loading, PageHead, Pill, useLoad } from '../ui'

type Dash = {
  cards: { active: number; grace: number; due: number; pending: number; classesToday: number; checkedInToday: number; collectedThisMonthPaise: number; leadsToFollow: number }
  today: { id: string; title: string; startsAt: string; mode: string; coach: string; capacity: number; booked: number; checkedIn: number; status: string }[]
}

export default function Dashboard() {
  const { data, error, loading } = useLoad(() => api.get<Dash>('/admin/dashboard'))
  if (loading && !data) return <Loading />
  if (!data) return <ErrorNote error={error} />
  const c = data.cards
  const cards: [string, string | number, string, string?][] = [
    ['Active members', c.active, '/app/admin/members?status=ACTIVE'],
    ['In grace', c.grace, '/app/admin/members?status=GRACE', c.grace ? 'warn' : undefined],
    ['Due', c.due, '/app/admin/members?status=DUE', c.due ? 'bad' : undefined],
    ['Payments to verify', c.pending, '/app/admin/payments', c.pending ? 'warn' : undefined],
    ['Classes today', c.classesToday, '/app/coach'],
    ['Checked in today', c.checkedInToday, '/app/coach'],
    ['Collected this month', rupees(c.collectedThisMonthPaise), '/app/admin/reports'],
    ['Leads to follow up', c.leadsToFollow, '/app/admin/leads', c.leadsToFollow ? 'warn' : undefined],
  ]
  return (
    <div>
      <PageHead title="Dashboard" sub={new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' })} />
      <div className="kpis">
        {cards.map(([label, value, to, tone]) => (
          <Link key={label} to={to} className={`acard kpi ${tone ? `kpi--${tone}` : ''}`}>
            <span className="kpi__v">{value}</span>
            <span className="kpi__l">{label}</span>
          </Link>
        ))}
      </div>
      <h2 className="h2">Today's schedule</h2>
      {!data.today.length ? (
        <Empty title="No classes today" />
      ) : (
        <Card className="tablecard">
          <table className="atable">
            <thead>
              <tr>
                <th>Time</th>
                <th>Class</th>
                <th>Coach</th>
                <th>Booked</th>
                <th>Present</th>
              </tr>
            </thead>
            <tbody>
              {data.today.map((x) => (
                <tr key={x.id}>
                  <td>{fmtTime(x.startsAt)}</td>
                  <td>
                    <Link to={`/app/coach/class/${x.id}`}>{x.title}</Link> <Pill status={x.mode} /> {x.status !== 'SCHEDULED' && <Pill status={x.status} />}
                  </td>
                  <td>{x.coach}</td>
                  <td>
                    {x.booked}/{x.capacity}
                  </td>
                  <td>{x.checkedIn}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
