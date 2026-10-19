// PAY-10, BILL-5: pending payments to verify, exports
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { addDays, api, fmtDay, fmtWhen, istToday, rupees } from '../api'
import { Button, Card, Empty, ErrorNote, Field, Loading, PageHead, Sheet, useAction, useLoad } from '../ui'

type Pending = { id: string; batchId: string | null; profileId: string; member: string; memberCode: string; plan: string; amountPaise: number; planPricePaise: number; utr: string | null; note: string | null; hasProof: boolean; createdAt: string }
type ListRow = { paidOn: string; member: string; memberCode: string; plan: string; amount: string; method: string; utr: string; status: string; receipts: string }

export default function Payments() {
  const { data, error, loading, reload } = useLoad(() => api.get<{ payments: Pending[] }>('/payments/pending'))
  const [from, setFrom] = useState(`${istToday().slice(0, 7)}-01`)
  const [to, setTo] = useState(istToday())
  const list = useLoad(() => api.get<{ payments: ListRow[]; totalPaise: number }>(`/payments/list?from=${from}&to=${to}`), [from, to])
  const [reject, setReject] = useState<Pending | null>(null)
  const { busy, run } = useAction()
  const wait = (iso: string) => {
    const h = Math.round((Date.now() - new Date(iso).getTime()) / 3600_000)
    return h < 1 ? 'just now' : h < 24 ? `${h} h` : `${Math.round(h / 24)} d`
  }
  return (
    <div>
      <PageHead title="Payments" sub="Check each one in your bank or UPI app, then verify" />
      <h2 className="h2">To verify {data?.payments.length ? `(${data.payments.length})` : ''}</h2>
      <ErrorNote error={error} />
      {loading && !data ? (
        <Loading />
      ) : !data?.payments.length ? (
        <Empty title="All caught up">No payments waiting.</Empty>
      ) : (
        <ul className="hist">
          {data.payments.map((p) => (
            <li key={p.id} className="acard pend">
              <div className="pend__main">
                <strong>
                  <Link to={`/app/admin/members/${p.profileId}`}>{p.member}</Link> <span className="muted small">{p.memberCode}</span>
                </strong>
                <span>
                  {p.plan} · <strong>{rupees(p.amountPaise)}</strong>
                  {p.amountPaise !== p.planPricePaise && <span className="aerror small"> (plan price {rupees(p.planPricePaise)})</span>}
                </span>
                <span className="small">
                  UTR <code>{p.utr ?? 'same payment as sibling'}</code> · note <code>{p.note ?? '–'}</code>
                  {p.batchId && <span className="muted"> · paid together</span>}
                </span>
                <span className="muted small">
                  Sent {fmtWhen(p.createdAt)} · waiting {wait(p.createdAt)}
                  {p.hasProof && (
                    <>
                      {' · '}
                      <a href={`/api/payments/${p.id}/proof`} target="_blank" rel="noreferrer">
                        Screenshot
                      </a>
                    </>
                  )}
                </span>
              </div>
              <div className="pend__act">
                <Button size="sm" busy={busy === 'v' + p.id} onClick={() => run('v' + p.id, async () => { const r = await api.post<{ receipt: string }>(`/payments/${p.id}/verify`); await Promise.all([reload(), list.reload()]); return r }, 'Verified, receipt sent')}>
                  Verify
                </Button>
                <Button size="sm" variant="quiet" onClick={() => setReject(p)}>
                  Reject
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2 className="h2">All payments</h2>
      <div className="filters">
        <Field label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Field label="To" type="date" value={to} max={istToday()} onChange={(e) => setTo(e.target.value)} />
        <a className="ab ab--ghost ab--sm" href={`/api/payments/list?from=${from}&to=${to}&format=csv`}>
          Download CSV
        </a>
        <button className="alink" onClick={() => (setFrom(addDays(istToday(), -30)), setTo(istToday()))}>
          Last 30 days
        </button>
      </div>
      {list.data && (
        <Card className="tablecard">
          <p className="tablecard__sum">
            Verified total: <strong>{rupees(list.data.totalPaise)}</strong>
          </p>
          <table className="atable">
            <thead>
              <tr>
                <th>Date</th>
                <th>Member</th>
                <th>Plan</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Status</th>
                <th>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {list.data.payments.map((p, i) => (
                <tr key={i}>
                  <td>{fmtDay(p.paidOn)}</td>
                  <td>
                    {p.member} <span className="muted small">{p.memberCode}</span>
                  </td>
                  <td>{p.plan}</td>
                  <td>₹{Number(p.amount).toLocaleString('en-IN')}</td>
                  <td>
                    {p.method}
                    {p.utr && <div className="muted small">{p.utr}</div>}
                  </td>
                  <td>{p.status.toLowerCase()}</td>
                  <td className="small">
                    {p.receipts.split(' ').filter(Boolean).map((r) => (
                      <div key={r}>
                        <a href={`/api/payments/receipts/${r}`} target="_blank" rel="noreferrer">
                          {r}
                        </a>
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {reject && <Reject p={reject} onClose={() => setReject(null)} onDone={() => (setReject(null), void reload())} />}
    </div>
  )
}

function Reject({ p, onClose, onDone }: { p: Pending; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('')
  const { busy, run } = useAction()
  return (
    <Sheet title={`Reject payment from ${p.member}`} onClose={onClose}>
      <p className="muted">The member is told why and can send a corrected UTR.</p>
      <Field label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. No payment with this UTR in the bank statement" />
      <Button variant="danger" block busy={!!busy} disabled={reason.length < 3} onClick={() => run('r', () => api.post(`/payments/${p.id}/reject`, { reason }), 'Rejected and member told').then((r) => r && onDone())}>
        Reject
      </Button>
    </Sheet>
  )
}
