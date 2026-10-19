// ADM-3: member list with search and filters
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, fmtDay } from '../api'
import { Card, Empty, ErrorNote, Loading, PageHead, Pill, Select, useLoad } from '../ui'

type Row = { profileId: string; name: string; memberCode: string; kind: string; status: string; plans: string[]; paidUntil: string | null; dueDays: number; attended: number; account: { name: string; phone: string; email: string; disabled: boolean } | null }

export default function Members() {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? 'ALL'
  const [q, setQ] = useState(params.get('q') ?? '')
  const programs = useLoad(() => api.get<{ programs: { id: string; name: string }[] }>('/staff/meta'))
  const programId = params.get('program') ?? ''
  const { data, error, loading } = useLoad(() => api.get<{ members: Row[] }>(`/admin/members?status=${status}${params.get('q') ? `&q=${encodeURIComponent(params.get('q')!)}` : ''}${programId ? `&programId=${programId}` : ''}`), [params.toString()])
  const update = (k: string, v: string) => {
    const p = new URLSearchParams(params)
    if (v && v !== 'ALL') p.set(k, v)
    else p.delete(k)
    setParams(p, { replace: true })
  }
  return (
    <div>
      <PageHead title="Members" sub={data ? `${data.members.length} shown` : undefined} />
      <form className="filters" onSubmit={(e) => (e.preventDefault(), update('q', q.trim()))} role="search">
        <label className="af af--grow">
          <span className="af__label">Search</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, phone, email or UF code" />
        </label>
        <Select label="Status" value={status} onChange={(e) => update('status', e.target.value)}>
          <option value="ALL">All</option>
          <option value="ACTIVE">Active</option>
          <option value="GRACE">In grace</option>
          <option value="DUE">Due</option>
          <option value="NONE">No plan</option>
        </Select>
        <Select label="Program" value={programId} onChange={(e) => update('program', e.target.value)}>
          <option value="">All</option>
          {programs.data?.programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </form>
      <ErrorNote error={error} />
      {loading && !data ? (
        <Loading />
      ) : !data?.members.length ? (
        <Empty title="No members match" />
      ) : (
        <Card className="tablecard">
          <table className="atable">
            <thead>
              <tr>
                <th>Member</th>
                <th>Status</th>
                <th>Plan</th>
                <th>Paid until</th>
                <th>Classes</th>
                <th>Account</th>
              </tr>
            </thead>
            <tbody>
              {data.members.map((m) => (
                <tr key={m.profileId}>
                  <td>
                    <Link to={`/app/admin/members/${m.profileId}`}>
                      <strong>{m.name}</strong>
                    </Link>
                    <div className="muted small">
                      {m.memberCode} · {m.kind === 'CHILD' ? 'Child' : 'Adult'}
                    </div>
                  </td>
                  <td>
                    <Pill status={m.status} />
                    {m.dueDays > 0 && <div className="muted small">{m.dueDays} days</div>}
                  </td>
                  <td>{m.plans.join(', ') || '–'}</td>
                  <td>{m.paidUntil ? fmtDay(m.paidUntil) : '–'}</td>
                  <td>{m.attended}</td>
                  <td className="small">
                    {m.account ? (
                      <>
                        {m.account.name}
                        <div className="muted">{m.account.phone}</div>
                      </>
                    ) : (
                      '–'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
