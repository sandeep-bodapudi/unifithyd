// AuditLog and MessageLog viewers (FR audit, MSG-3)
import { useState } from 'react'
import { api, fmtWhen } from '../api'
import { Card, ErrorNote, Loading, PageHead, Pill, useLoad } from '../ui'

type Audit = { id: string; actor: string | null; action: string; entity: string; entityId: string | null; oldValue: unknown; newValue: unknown; ip: string | null; at: string }
type Msg = { id: string; to: string; name: string; template: string; channel: string; status: string; attempts: number; error: string | null; at: string }

export default function Logs() {
  const [tab, setTab] = useState<'audit' | 'messages'>('audit')
  const [filter, setFilter] = useState('')
  const audit = useLoad(() => api.get<{ audit: Audit[] }>(`/admin/audit${filter ? `?action=${encodeURIComponent(filter)}` : ''}`), [filter])
  const msgs = useLoad(() => api.get<{ messages: Msg[] }>('/admin/messages'))
  return (
    <div>
      <PageHead title="Logs" sub="Every important change and every message, kept for review" />
      <div className="seg" role="tablist">
        <button role="tab" aria-selected={tab === 'audit'} className={tab === 'audit' ? 'on' : ''} onClick={() => setTab('audit')}>
          Changes
        </button>
        <button role="tab" aria-selected={tab === 'messages'} className={tab === 'messages' ? 'on' : ''} onClick={() => setTab('messages')}>
          Messages
        </button>
      </div>
      {tab === 'audit' ? (
        <>
          <div className="filters">
            <label className="af">
              <span className="af__label">Filter</span>
              <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="">Everything</option>
                <option value="settings">Settings and UPI</option>
                <option value="payment">Payments</option>
                <option value="attendance">Attendance</option>
                <option value="staff">Staff</option>
                <option value="login">Logins</option>
                <option value="privacy">Privacy requests</option>
                <option value="class">Classes</option>
              </select>
            </label>
          </div>
          <ErrorNote error={audit.error} />
          {audit.loading && !audit.data ? (
            <Loading />
          ) : (
            <Card className="tablecard">
              <table className="atable">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Who</th>
                    <th>What</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.data?.audit.map((a) => (
                    <tr key={a.id}>
                      <td className="small">{fmtWhen(a.at)}</td>
                      <td>{a.actor ?? 'system'}</td>
                      <td>
                        <code>{a.action}</code>
                      </td>
                      <td className="small logdetail">{a.newValue ? JSON.stringify(a.newValue).slice(0, 160) : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      ) : (
        <Card className="tablecard">
          <table className="atable">
            <thead>
              <tr>
                <th>When</th>
                <th>To</th>
                <th>Message</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {msgs.data?.messages.map((m) => (
                <tr key={m.id}>
                  <td className="small">{fmtWhen(m.at)}</td>
                  <td>
                    {m.name}
                    <div className="muted small">{m.to}</div>
                  </td>
                  <td>{m.template.replace(/_/g, ' ')}</td>
                  <td>
                    <Pill status={m.status} />
                    {m.error && <div className="aerror small">{m.error.slice(0, 80)}</div>}
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
