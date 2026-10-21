// ADM-4: everything about one member, with actions
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { addDays, api, fmtDay, fmtWhen, istToday, rupees } from '../api'
import { Button, Card, Empty, ErrorNote, Field, Loading, PageHead, Pill, Select, Sheet, TextArea, useAction, useLoad } from '../ui'

type Detail = {
  profile: { id: string; name: string; memberCode: string; kind: string; dob: string; emergencyNote: string | null; photoConsent: boolean; createdAt: string }
  accounts: { id: string; name: string; email: string; phone: string; disabled: boolean; roles: string[] }[]
  plans: { planId: string; planName: string; status: string; end: string; creditsLeft: number | null; weekLeft: number | null; makeupCredits: number }[]
  memberships: { id: string; plan: string; start: string; end: string; status: string; source: string; freezes: { start: string; days: number; reason: string }[] }[]
  payments: { id: string; plan: string; amountPaise: number; method: string; status: string; utr: string | null; paidOn: string; reason: string | null; receipts: { number: string; kind: string }[] }[]
  bookings: { id: string; status: string; title: string; startsAt: string; mode: string }[]
  credits: { delta: number; kind: string; expiresOn: string | null; reason: string }[]
  consents: { document: string; version: string; acceptedAt: string }[]
  messages: { template: string; channel: string; status: string; at: string }[]
  audit: { id: string; action: string; at: string }[]
}

export default function MemberDetail() {
  const { id } = useParams()
  const { data, error, loading, reload } = useLoad(() => api.get<Detail>(`/admin/members/${id}`), [id])
  const [sheet, setSheet] = useState<null | 'pay' | 'freeze' | 'makeup' | 'reverse' | 'edit'>(null)
  const [target, setTarget] = useState<string | null>(null)
  const { busy, run } = useAction()
  if (loading && !data) return <Loading />
  if (!data) return <ErrorNote error={error} />
  const p = data.profile
  const acc = data.accounts[0]
  return (
    <div>
      <PageHead
        title={p.name}
        sub={`${p.memberCode} · ${p.kind === 'CHILD' ? 'Child' : 'Adult'} · born ${fmtDay(p.dob)} · joined ${fmtDay(p.createdAt.slice(0, 10))}`}
        action={
          <div className="arow arow--wrap">
            <Button size="sm" onClick={() => setSheet('pay')}>
              Record payment
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSheet('makeup')}>
              Make-up class
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSheet('edit')}>
              Edit
            </Button>
          </div>
        }
      />
      <div className="grid2">
        <Card>
          <h2 className="h3">Plans</h2>
          {data.plans.length ? (
            data.plans.map((x) => (
              <div key={x.planId} className="kv">
                <span>
                  <strong>{x.planName}</strong>
                  <span className="muted small">
                    {' '}
                    until {fmtDay(x.end)}
                    {x.creditsLeft !== null ? ` · ${x.creditsLeft} left this cycle` : ''}
                    {x.makeupCredits ? ` · ${x.makeupCredits} make-up` : ''}
                  </span>
                </span>
                <Pill status={x.status} />
              </div>
            ))
          ) : (
            <Empty
              compact
              title="No plan yet"
              action={
                <Button size="sm" variant="ghost" onClick={() => setSheet('pay')}>
                  Record payment
                </Button>
              }
            >
              A plan starts when a payment is verified or recorded.
            </Empty>
          )}
          <h3 className="h4">Membership periods</h3>
          {!data.memberships.length && <p className="muted small">Each paid month appears here with its dates and any freezes.</p>}
          <ul className="mini">
            {data.memberships.map((m) => (
              <li key={m.id}>
                <span>
                  {m.plan}: {fmtDay(m.start)} to {fmtDay(m.end)} {m.source === 'IMPORTED' && <span className="muted small">(imported)</span>}
                  {m.freezes.map((f, i) => (
                    <span key={i} className="muted small">
                      {' '}
                      · paused {f.days}d from {fmtDay(f.start)}
                    </span>
                  ))}
                </span>
                <span>
                  {m.status === 'CANCELLED' ? (
                    <Pill status="CANCELLED" />
                  ) : (
                    !m.freezes.length && (
                      <button className="alink small" onClick={() => (setTarget(m.id), setSheet('freeze'))}>
                        Freeze
                      </button>
                    )
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="h3">Account</h2>
          {!data.accounts.length && <Empty compact title="No login account">This member's details were removed, or no parent account is linked.</Empty>}
          {data.accounts.map((a) => (
            <div key={a.id} className="kv kv--col">
              <strong>{a.name}</strong>
              <span>
                <a href={`tel:+91${a.phone}`}>{a.phone}</a> · <a href={`mailto:${a.email}`}>{a.email}</a>
              </span>
              {a.disabled && <Pill status="CANCELLED" label="Disabled" />}
            </div>
          ))}
          {p.emergencyNote && (
            <p className="small">
              <strong>Emergency / health note:</strong> {p.emergencyNote}
            </p>
          )}
          <p className="small muted">Photo consent: {p.photoConsent ? 'yes' : 'no'}</p>
          <h3 className="h4">Documents accepted</h3>
          {!data.consents.length && <p className="muted small">Not accepted yet. The member is asked to accept the terms, privacy policy, waiver and refund policy at their next login.</p>}
          <ul className="mini">
            {data.consents.slice(0, 8).map((c, i) => (
              <li key={i}>
                {c.document} v{c.version} <span className="muted small">{fmtWhen(c.acceptedAt)}</span>
              </li>
            ))}
          </ul>
          {acc && (
            <div className="arow arow--wrap">
              <Button size="sm" variant="ghost" busy={busy === 'dis'} onClick={() => run('dis', async () => { await api.post(`/admin/accounts/${acc.id}/disabled`, { disabled: !acc.disabled }); await reload() }, acc.disabled ? 'Account enabled' : 'Account disabled')}>
                {acc.disabled ? 'Enable account' : 'Disable account'}
              </Button>
              <Button size="sm" variant="danger" busy={busy === 'anon'} onClick={() => confirm('Anonymise this member? Their personal details are removed for good. Payment records stay for accounting.') && run('anon', async () => { await api.post(`/admin/members/${p.id}/anonymise`); await reload() }, 'Member anonymised')}>
                Delete personal data
              </Button>
            </div>
          )}
        </Card>
      </div>

      <h2 className="h2">Payments</h2>
      <Card className="tablecard">
        <table className="atable">
          <thead>
            <tr>
              <th>Date</th>
              <th>Plan</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Receipt</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.payments.map((x) => (
              <tr key={x.id}>
                <td>{fmtDay(x.paidOn)}</td>
                <td>
                  {x.plan}
                  <div className="muted small">
                    {x.method}
                    {x.utr ? ` · ${x.utr}` : ''}
                    {x.reason ? ` · ${x.reason}` : ''}
                  </div>
                </td>
                <td>{rupees(x.amountPaise)}</td>
                <td>
                  <Pill status={x.status} />
                </td>
                <td className="small">
                  {x.receipts.map((r) => (
                    <div key={r.number}>
                      <a href={`/api/payments/receipts/${r.number}`} target="_blank" rel="noreferrer">
                        {r.number}
                      </a>
                    </div>
                  ))}
                </td>
                <td>
                  {x.status === 'VERIFIED' && (
                    <button className="alink small" onClick={() => (setTarget(x.id), setSheet('reverse'))}>
                      Reverse / refund
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!data.payments.length && (
              <tr>
                <td colSpan={6}>
                  <Empty
                    compact
                    title="No payments yet"
                    action={
                      <Button size="sm" variant="ghost" onClick={() => setSheet('pay')}>
                        Record payment
                      </Button>
                    }
                  >
                    UPI payments the member sends and cash you record show here with their receipts.
                  </Empty>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <div className="grid2">
        <Card>
          <h2 className="h3">Recent bookings</h2>
          {!data.bookings.length && <Empty compact title="No bookings yet">Classes this member books, attends or misses appear here.</Empty>}
          <ul className="mini">
            {data.bookings.map((b) => (
              <li key={b.id}>
                <span>
                  {b.title} <span className="muted small">{fmtWhen(b.startsAt)}</span>
                </span>
                <Pill status={b.status} />
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="h3">Messages sent</h2>
          {!data.messages.length && <p className="muted small">No messages yet. Reminders, receipts and notices sent to this member are listed here.</p>}
          <ul className="mini">
            {data.messages.map((m, i) => (
              <li key={i}>
                <span>
                  {m.template.replace(/_/g, ' ')} <span className="muted small">{fmtWhen(m.at)}</span>
                </span>
                <Pill status={m.status} />
              </li>
            ))}
          </ul>
          <h3 className="h4">History</h3>
          {!data.audit.length && <p className="muted small">No changes yet. Payments, freezes and edits for this member are logged here.</p>}
          <ul className="mini">
            {data.audit.slice(0, 12).map((a) => (
              <li key={a.id}>
                {a.action} <span className="muted small">{fmtWhen(a.at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {sheet === 'pay' && <RecordPayment profileId={p.id} kind={p.kind} onClose={() => setSheet(null)} onDone={() => (setSheet(null), void reload())} />}
      {sheet === 'freeze' && target && <Freeze membershipId={target} onClose={() => setSheet(null)} onDone={() => (setSheet(null), void reload())} />}
      {sheet === 'makeup' && <Makeup profileId={p.id} onClose={() => setSheet(null)} onDone={() => (setSheet(null), void reload())} />}
      {sheet === 'reverse' && target && <Reverse paymentId={target} onClose={() => setSheet(null)} onDone={() => (setSheet(null), void reload())} />}
      {sheet === 'edit' && <EditProfile p={p} onClose={() => setSheet(null)} onDone={() => (setSheet(null), void reload())} />}
      <p className="muted small">
        <Link to="/app/admin/members">← All members</Link>
      </p>
    </div>
  )
}

export function RecordPayment({ profileId, kind, onClose, onDone }: { profileId: string; kind: string; onClose: () => void; onDone: () => void }) {
  const plans = useLoad(() => api.get<{ plans: { id: string; name: string; pricePaise: number; audience: string; active: boolean }[] }>('/admin/plans'))
  const usable = plans.data?.plans.filter((p) => p.active && (p.audience === 'MIXED' || (kind === 'CHILD' ? p.audience === 'KIDS' : p.audience === 'ADULTS'))) ?? []
  const [f, setF] = useState({ planId: '', amount: '', paidOn: istToday(), method: 'UPI', utr: '', reason: '' })
  const plan = usable.find((p) => p.id === f.planId)
  const { busy, run } = useAction()
  return (
    <Sheet title="Record a payment" onClose={onClose}>
      <Select label="Plan" value={f.planId} onChange={(e) => setF({ ...f, planId: e.target.value, amount: String((usable.find((p) => p.id === e.target.value)?.pricePaise ?? 0) / 100) })}>
        <option value="">Choose…</option>
        {usable.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} · {rupees(p.pricePaise)}
          </option>
        ))}
      </Select>
      {plans.data && !usable.length && (
        <p className="aerror small">
          No active {kind === 'CHILD' ? 'kids' : 'adult'} plan. <Link to="/app/admin/settings">Add or turn on a plan in Settings</Link> first.
        </p>
      )}
      <div className="arow2">
        <Field label="Amount (₹)" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        <Field label="Paid on" type="date" max={istToday()} value={f.paidOn} onChange={(e) => setF({ ...f, paidOn: e.target.value })} />
      </div>
      <div className="arow2">
        <Select label="Method" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>
          <option value="UPI">UPI</option>
          <option value="CASH">Cash</option>
        </Select>
        {f.method === 'UPI' && <Field label="UTR (12 digits)" inputMode="numeric" value={f.utr} onChange={(e) => setF({ ...f, utr: e.target.value })} />}
      </div>
      {plan && Math.round(Number(f.amount) * 100) !== plan.pricePaise && <Field label="Reason for a different amount" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="e.g. 10% sibling discount" />}
      <Button
        block
        busy={!!busy}
        disabled={!plan || !Number(f.amount)}
        onClick={() =>
          run('pay', () => api.post<{ receipt: string; end: string }>('/payments/record', { profileId, planId: f.planId, amountPaise: Math.round(Number(f.amount) * 100), paidOn: f.paidOn, method: f.method, utr: f.utr || undefined, reason: f.reason || undefined })).then(
            (r) => r && (alert(`Recorded. Receipt ${r.receipt}. Membership until ${fmtDay(r.end)}.`), onDone()),
          )
        }
      >
        Record and send receipt
      </Button>
    </Sheet>
  )
}

function Freeze({ membershipId, onClose, onDone }: { membershipId: string; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ startDay: istToday(), days: 7, reason: '' })
  const { busy, run } = useAction()
  return (
    <Sheet title="Freeze membership" onClose={onClose}>
      <p className="muted">One freeze per membership, up to 14 days. The end date moves later; bookings inside the freeze are cancelled with credits returned.</p>
      <div className="arow2">
        <Field label="From" type="date" value={f.startDay} onChange={(e) => setF({ ...f, startDay: e.target.value })} />
        <Field label="Days" type="number" min={1} max={14} value={f.days} onChange={(e) => setF({ ...f, days: Number(e.target.value) })} />
      </div>
      <Field label="Reason" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
      <Button block busy={!!busy} disabled={f.reason.length < 3} onClick={() => run('f', () => api.post<{ newEnd: string }>(`/admin/memberships/${membershipId}/freeze`, f)).then((r) => r && (alert(`Frozen. New end date ${fmtDay(r.newEnd)}.`), onDone()))}>
        Freeze
      </Button>
    </Sheet>
  )
}

function Makeup({ profileId, onClose, onDone }: { profileId: string; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ count: 1, expiresOn: addDays(istToday(), 30), reason: '' })
  const { busy, run } = useAction()
  return (
    <Sheet title="Give a make-up class" onClose={onClose}>
      <div className="arow2">
        <Field label="Classes" type="number" min={1} max={5} value={f.count} onChange={(e) => setF({ ...f, count: Number(e.target.value) })} />
        <Field label="Use by" type="date" value={f.expiresOn} onChange={(e) => setF({ ...f, expiresOn: e.target.value })} />
      </div>
      <Field label="Reason" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
      <Button block busy={!!busy} disabled={f.reason.length < 3} onClick={() => run('m', () => api.post(`/admin/members/${profileId}/makeup`, f), 'Make-up class added').then((r) => r && onDone())}>
        Add
      </Button>
    </Sheet>
  )
}

function Reverse({ paymentId, onClose, onDone }: { paymentId: string; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('')
  const [refund, setRefund] = useState(false)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('UPI')
  const { busy, run } = useAction()
  return (
    <Sheet title="Reverse or refund" onClose={onClose}>
      <p className="muted">The membership period is cancelled, later periods move up, and a credit note is issued. Nothing is deleted.</p>
      <TextArea label="Reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
      <Select label="Type" value={refund ? 'refund' : 'reverse'} onChange={(e) => setRefund(e.target.value === 'refund')}>
        <option value="reverse">Reversal (payment was wrong)</option>
        <option value="refund">Refund (money returned)</option>
      </Select>
      {refund && (
        <div className="arow2">
          <Field label="Refund amount (₹)" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Select label="Refunded by" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="UPI">UPI</option>
            <option value="CASH">Cash</option>
            <option value="BANK">Bank transfer</option>
          </Select>
        </div>
      )}
      <Button
        variant="danger"
        block
        busy={!!busy}
        disabled={reason.length < 3 || (refund && !Number(amount))}
        onClick={() =>
          run('r', () => api.post<{ creditNote: string; flaggedBookings: number }>(`/payments/${paymentId}/reverse`, { reason, refund: refund ? { amountPaise: Math.round(Number(amount) * 100), method } : undefined })).then(
            (r) => r && (alert(`Done. Credit note ${r.creditNote}.${r.flaggedBookings ? ` ${r.flaggedBookings} future bookings are no longer covered: check them.` : ''}`), onDone()),
          )
        }
      >
        Confirm
      </Button>
    </Sheet>
  )
}

function EditProfile({ p, onClose, onDone }: { p: Detail['profile']; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: p.name, emergencyNote: p.emergencyNote ?? '', photoConsent: p.photoConsent })
  const { busy, run } = useAction()
  return (
    <Sheet title="Edit member" onClose={onClose}>
      <Field label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <TextArea label="Emergency contact / health note (admin and class coach only)" rows={3} value={f.emergencyNote} onChange={(e) => setF({ ...f, emergencyNote: e.target.value })} />
      <Select label="Photo consent (website and social media)" value={f.photoConsent ? 'yes' : 'no'} onChange={(e) => setF({ ...f, photoConsent: e.target.value === 'yes' })}>
        <option value="no">No</option>
        <option value="yes">Yes, written consent received</option>
      </Select>
      <Button block busy={!!busy} onClick={() => run('e', () => api.patch(`/admin/members/${p.id}`, { ...f, emergencyNote: f.emergencyNote || null }), 'Saved').then((r) => r && onDone())}>
        Save
      </Button>
      <ErrorNote error={null} />
    </Sheet>
  )
}
