// ADM-5, ADM-6: attendance, revenue and coach reports
import { useState } from 'react'
import { addDays, api, istToday, rupees } from '../api'
import { Card, ErrorNote, Field, Loading, PageHead, Select, useLoad } from '../ui'

type R = {
  attendance: { program: string; classes: number; booked: number; attended: number; noShows: number }[]
  coaches: { coach: string; classes: number; attended: number; avgAttendance: number }[]
  revenue: { plan: string; paise: number }[]
  totals: { revenuePaise: number; payments: number; newMembers: number; renewals: number }
}

export default function Reports() {
  const [from, setFrom] = useState(addDays(istToday(), -30))
  const [to, setTo] = useState(istToday())
  const [mode, setMode] = useState('ALL')
  const { data, error, loading } = useLoad(() => api.get<R>(`/admin/reports?from=${from}&to=${to}&mode=${mode}`), [from, to, mode])
  const maxRev = Math.max(1, ...(data?.revenue.map((r) => r.paise) ?? [1]))
  return (
    <div>
      <PageHead title="Reports" />
      <div className="filters">
        <Field label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Field label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <Select label="Mode" value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="ALL">Studio and online</option>
          <option value="OFFLINE">Studio</option>
          <option value="ONLINE">Online</option>
        </Select>
      </div>
      <ErrorNote error={error} />
      {loading && !data ? (
        <Loading />
      ) : (
        data && (
          <>
            <div className="kpis">
              <Card className="kpi">
                <span className="kpi__v">{rupees(data.totals.revenuePaise)}</span>
                <span className="kpi__l">Collected</span>
              </Card>
              <Card className="kpi">
                <span className="kpi__v">{data.totals.newMembers}</span>
                <span className="kpi__l">New paying members</span>
              </Card>
              <Card className="kpi">
                <span className="kpi__v">{data.totals.renewals}</span>
                <span className="kpi__l">Renewals</span>
              </Card>
              <Card className="kpi">
                <span className="kpi__v">{data.attendance.reduce((s, a) => s + a.attended, 0)}</span>
                <span className="kpi__l">Check-ins</span>
              </Card>
            </div>
            <h2 className="h2">Revenue by plan</h2>
            <Card>
              {data.revenue.length ? (
                data.revenue.map((r) => (
                  <div key={r.plan} className="bar">
                    <span className="bar__label">{r.plan}</span>
                    <span className="bar__track">
                      <span className="bar__fill" style={{ width: `${(r.paise / maxRev) * 100}%` }} />
                    </span>
                    <span className="bar__value">{rupees(r.paise)}</span>
                  </div>
                ))
              ) : (
                <p className="muted">No payments in this range.</p>
              )}
            </Card>
            <h2 className="h2">Attendance by program</h2>
            <Card className="tablecard">
              <table className="atable">
                <thead>
                  <tr>
                    <th>Program</th>
                    <th>Classes</th>
                    <th>Booked</th>
                    <th>Attended</th>
                    <th>No-shows</th>
                    <th>No-show rate</th>
                  </tr>
                </thead>
                <tbody>
                  {data.attendance.map((a) => (
                    <tr key={a.program}>
                      <td>{a.program}</td>
                      <td>{a.classes}</td>
                      <td>{a.booked}</td>
                      <td>{a.attended}</td>
                      <td>{a.noShows}</td>
                      <td>{a.booked ? `${Math.round((a.noShows / a.booked) * 100)}%` : '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <h2 className="h2">Coaches</h2>
            <Card className="tablecard">
              <table className="atable">
                <thead>
                  <tr>
                    <th>Coach</th>
                    <th>Classes taught</th>
                    <th>Check-ins</th>
                    <th>Average per class</th>
                  </tr>
                </thead>
                <tbody>
                  {data.coaches.map((c) => (
                    <tr key={c.coach}>
                      <td>{c.coach}</td>
                      <td>{c.classes}</td>
                      <td>{c.attended}</td>
                      <td>{c.avgAttendance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </>
        )
      )}
    </div>
  )
}
