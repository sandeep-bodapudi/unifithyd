// Pay by UPI with member code in the note, then "I have paid" with UTR (PAY-4 to PAY-9)
import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, fmtDay, rupees } from '../api'
import { ProfileSwitcher, useProfile } from '../App'
import { useSession } from '../session'
import { Button, Card, Check, Empty, ErrorNote, Field, Loading, PageHead, Pill, useAction, useLoad } from '../ui'

type Options = {
  profile: { id: string; name: string; memberCode: string; kind: string }
  upi: { upiId: string; payeeName: string } | null
  current: { planId: string; planName: string; status: string; end: string; creditsLeft: number | null }[]
  pending: { id: string; plan: string; amountPaise: number; utr: string | null; createdAt: string }[]
  options: { planId: string; name: string; pricePaise: number; programs: string[]; creditsPerCycle: number | null; weeklyCap: number | null; nextStart: string; nextEnd: string; note: string; upiLink: string | null }[]
}
type History = { payments: { id: string; plan: string; amountPaise: number; status: string; utr: string | null; paidOn: string; reason: string | null; period: { start: string; end: string } | null; receipts: { number: string; kind: string }[] }[] }

const isPhone = () => /Android|iPhone|iPad/i.test(navigator.userAgent)

export default function PayTab() {
  const { me } = useSession()
  const { profileId } = useProfile()
  const { data, error, loading, reload } = useLoad(() => (profileId ? api.get<Options>(`/payments/options/${profileId}`) : Promise.resolve(null)), [profileId])
  const history = useLoad(() => (profileId ? api.get<History>(`/payments/history/${profileId}`) : Promise.resolve(null)), [profileId])
  const [planId, setPlanId] = useState<string | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const chosen = data?.options.find((o) => o.planId === planId) ?? data?.options[0]
  useEffect(() => {
    if (!chosen?.upiLink) return setQr(null)
    QRCode.toDataURL(chosen.upiLink, { margin: 1, width: 480, color: { dark: '#0B1F3F', light: '#FFFFFF' } }).then(setQr)
  }, [chosen?.upiLink])

  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      /* clipboard blocked: the text is visible to copy by hand */
    }
  }

  if (!profileId)
    return (
      <Empty
        title="No one added yet"
        action={
          <Link className="ab ab--primary ab--sm" to="/app/me">
            Add yourself or a child
          </Link>
        }
      >
        Add the person who trains, then choose their plan and pay by UPI here.
      </Empty>
    )
  if (loading && !data) return <Loading />
  if (!data) return <ErrorNote error={error} />

  return (
    <div>
      <PageHead title="Pay" sub={`For ${data.profile.name} · ${data.profile.memberCode}`} />
      <ProfileSwitcher />
      <section className="paystatus">
        {data.current.length === 0 ? (
          <Card>
            <strong>No plan yet</strong>
            <p className="muted">Choose a plan below. Your membership starts once the studio confirms your payment.</p>
          </Card>
        ) : (
          data.current.map((c) => (
            <Card key={c.planId} className="paystatus__item">
              <div>
                <strong>{c.planName}</strong>
                <p className="muted">{c.status === 'DUE' ? `Ended ${fmtDay(c.end)}` : `Paid until ${fmtDay(c.end)}`}</p>
              </div>
              <Pill status={c.status} />
            </Card>
          ))
        )}
        {data.pending.map((p) => (
          <Card key={p.id} className="paystatus__item">
            <div>
              <strong>{p.plan}</strong>
              <p className="muted">
                {rupees(p.amountPaise)} · UTR {p.utr ?? '(same payment)'} · waiting for the studio to confirm
              </p>
            </div>
            <Pill status="PENDING" />
          </Card>
        ))}
      </section>

      <h2 className="h2">Choose a plan</h2>
      {!data.options.length && (
        <Empty title={`No plans open for ${data.profile.name.split(' ')[0]} yet`}>
          The studio has not added a plan for this age group. Please ask at the front desk or on WhatsApp.
        </Empty>
      )}
      <div className="planpick" role="radiogroup" aria-label="Plan">
        {data.options.map((o) => (
          <button key={o.planId} role="radio" aria-checked={o.planId === chosen?.planId} className={`acard planpick__item ${o.planId === chosen?.planId ? 'on' : ''}`} onClick={() => setPlanId(o.planId)}>
            <strong>{o.name}</strong>
            <span className="planpick__price">{rupees(o.pricePaise)}</span>
            <small className="muted">
              {o.creditsPerCycle ? `${o.creditsPerCycle} classes a month${o.weeklyCap ? `, ${o.weeklyCap} a week` : ''}` : 'Unlimited classes'} · {o.programs.join(', ')}
            </small>
          </button>
        ))}
      </div>

      {chosen &&
        (!data.upi ? (
          <Card>
            <strong>Payment details coming soon</strong>
            <p className="muted">Please contact the studio to pay for now.</p>
          </Card>
        ) : (
          <Card className="upi">
            <div className="upi__qr">{qr && <img src={qr} alt={`UPI QR to pay ${rupees(chosen.pricePaise)} to ${data.upi.payeeName}`} />}</div>
            <div className="upi__info">
              <p className="upi__amount">{rupees(chosen.pricePaise)}</p>
              <p className="muted">
                Covers {fmtDay(chosen.nextStart)} to {fmtDay(chosen.nextEnd)} once confirmed
              </p>
              <dl>
                <dt>Pay to</dt>
                <dd>
                  {data.upi.payeeName} · <code>{data.upi.upiId}</code>{' '}
                  <button className="alink" onClick={() => copy('id', data.upi!.upiId)}>
                    {copied === 'id' ? 'Copied' : 'Copy'}
                  </button>
                </dd>
                <dt>Note</dt>
                <dd>
                  <code>{chosen.note}</code>{' '}
                  <button className="alink" onClick={() => copy('note', chosen.note)}>
                    {copied === 'note' ? 'Copied' : 'Copy'}
                  </button>
                </dd>
              </dl>
              <p className="anote">Keep the note as it is. It tells the studio who paid.</p>
              {isPhone() && chosen.upiLink && (
                <a className="ab ab--primary ab--block" href={chosen.upiLink}>
                  Open UPI app
                </a>
              )}
            </div>
          </Card>
        ))}

      {chosen && data.upi && <IHavePaid planId={chosen.planId} profileId={profileId} onDone={() => (void reload(), void history.reload())} />}

      <h2 className="h2">Payment history</h2>
      {history.loading && !history.data ? (
        <Loading />
      ) : history.data?.payments.length ? (
        <ul className="hist">
          {history.data.payments.map((p) => (
            <li key={p.id} className="acard hist__row">
              <div>
                <strong>{p.plan}</strong> · {rupees(p.amountPaise)}
                <p className="muted small">
                  {fmtDay(p.paidOn)}
                  {p.period ? ` · ${fmtDay(p.period.start)} to ${fmtDay(p.period.end)}` : ''}
                  {p.reason ? ` · ${p.reason}` : ''}
                </p>
                {p.receipts.map((r) => (
                  <a key={r.number} href={`/api/payments/receipts/${r.number}`} target="_blank" rel="noreferrer" className="small">
                    {r.kind === 'RECEIPT' ? 'Receipt' : 'Credit note'} {r.number}
                  </a>
                ))}
              </div>
              <Pill status={p.status} />
            </li>
          ))}
        </ul>
      ) : (
        <Empty compact title="No payments yet">
          After you pay and tap "I have paid", your payments and receipts are listed here.
        </Empty>
      )}
      {me!.profiles.length > 1 && <p className="muted small">Paying for several children at once? Tick them in "I have paid" so one UPI payment covers everyone.</p>}
    </div>
  )
}

function IHavePaid({ planId, profileId, onDone }: { planId: string; profileId: string; onDone: () => void }) {
  const { me } = useSession()
  const others = me!.profiles.filter((p) => p.id !== profileId && p.kind === me!.profiles.find((x) => x.id === profileId)?.kind)
  const [utr, setUtr] = useState('')
  const [also, setAlso] = useState<string[]>([])
  const [shot, setShot] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const { busy, run } = useAction()

  const pick = (f: File | undefined) => {
    setErr(null)
    if (!f) return setShot(null)
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) return setErr('Use a PNG, JPG or WebP image')
    if (f.size > 2 * 1024 * 1024) return setErr('The image must be under 2 MB')
    const r = new FileReader()
    r.onload = () => setShot(String(r.result))
    r.readAsDataURL(f)
  }

  const submit = () =>
    run(
      'paid',
      () => api.post('/payments/submit', { items: [profileId, ...also].map((id) => ({ profileId: id, planId })), utr, screenshot: shot ?? undefined }),
      'Thanks! The studio will confirm your payment soon.',
    ).then((r) => r && (setUtr(''), setShot(null), setAlso([]), onDone()))

  return (
    <Card className="paid">
      <h2 className="h3">I have paid</h2>
      <p className="muted small">Find the 12-digit UPI reference (UTR) in your UPI app's payment details.</p>
      <Field label="UPI reference (UTR)" inputMode="numeric" maxLength={14} value={utr} onChange={(e) => setUtr(e.target.value.replace(/[^\d ]/g, ''))} placeholder="12 digits" />
      {others.length > 0 && (
        <fieldset className="afieldset">
          <legend>This payment also covers</legend>
          {others.map((o) => (
            <Check key={o.id} label={o.name} checked={also.includes(o.id)} onChange={(e) => setAlso(e.target.checked ? [...also, o.id] : also.filter((x) => x !== o.id))} />
          ))}
        </fieldset>
      )}
      <label className="af">
        <span className="af__label">Screenshot (optional)</span>
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => pick(e.target.files?.[0])} />
      </label>
      {err && <p className="aerror">{err}</p>}
      <Button block busy={busy === 'paid'} disabled={utr.replace(/\s/g, '').length !== 12} onClick={submit}>
        Send for confirmation
      </Button>
    </Card>
  )
}
