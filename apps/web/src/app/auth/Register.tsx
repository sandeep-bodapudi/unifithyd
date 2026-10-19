// Registration for adults and parents with children (ACC-1, ACC-5, KID-1, KID-2)
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LogoLockup } from '../../brand/Logo'
import { api } from '../api'
import { useSession } from '../session'
import { Button, Check, ErrorNote, Field } from '../ui'

type Child = { name: string; dob: string }

export default function Register() {
  const nav = useNavigate()
  const { refresh } = useSession()
  const [f, setF] = useState({ name: '', email: '', phone: '', dob: '' })
  const [trainsSelf, setTrainsSelf] = useState(true)
  const [children, setChildren] = useState<Child[]>([])
  const [accept, setAccept] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [codeStep, setCodeStep] = useState<{ devCode?: string } | null>(null)
  const [code, setCode] = useState('')

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (!codeStep) {
        const r = await api.post<{ devCode?: string }>('/auth/register', {
          ...f,
          phone: f.phone.replace(/\D/g, '').slice(-10),
          dob: trainsSelf ? f.dob : undefined,
          trainsSelf,
          children: children.filter((c) => c.name || c.dob),
          acceptTerms: accept,
        })
        setCodeStep(r)
      } else {
        await api.post('/auth/verify-code', { email: f.email, code })
        await refresh()
        nav('/app/pay', { replace: true })
      }
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth">
      <form className="auth__card auth__card--wide" onSubmit={submit} noValidate>
        <Link to="/" className="auth__logo" aria-label="Unifit.hyd home">
          <LogoLockup height={40} />
        </Link>
        {codeStep ? (
          <>
            <h1>Check your email</h1>
            <p className="muted">We sent a 6-digit code to {f.email}.</p>
            <Field label="Code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} hint={codeStep.devCode ? `Development code: ${codeStep.devCode}` : undefined} autoFocus />
          </>
        ) : (
          <>
            <h1>Join Unifit</h1>
            <p className="muted">One account for you and your family. Parents add their children here.</p>
            <Field label="Your full name" autoComplete="name" value={f.name} onChange={set('name')} required />
            <Field label="Email" type="email" autoComplete="email" value={f.email} onChange={set('email')} required />
            <Field label="Mobile number" inputMode="tel" autoComplete="tel" placeholder="10-digit number" value={f.phone} onChange={set('phone')} required />
            <fieldset className="afieldset">
              <legend>Who will train?</legend>
              <Check label="Me" checked={trainsSelf} onChange={(e) => setTrainsSelf(e.target.checked)} />
              {trainsSelf && <Field label="Your date of birth" type="date" value={f.dob} onChange={set('dob')} max={new Date().toISOString().slice(0, 10)} />}
              {children.map((c, i) => (
                <div className="arow2" key={i}>
                  <Field label={`Child ${i + 1} name`} value={c.name} onChange={(e) => setChildren(children.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                  <Field label="Date of birth" type="date" value={c.dob} onChange={(e) => setChildren(children.map((x, j) => (j === i ? { ...x, dob: e.target.value } : x)))} />
                  <button type="button" className="alink" onClick={() => setChildren(children.filter((_, j) => j !== i))}>
                    Remove
                  </button>
                </div>
              ))}
              {children.length < 6 && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setChildren([...children, { name: '', dob: '' }])}>
                  + Add a child
                </Button>
              )}
            </fieldset>
            <Check
              checked={accept}
              onChange={(e) => setAccept(e.target.checked)}
              label={
                <>
                  I accept the{' '}
                  <Link to="/terms" target="_blank">
                    Terms
                  </Link>
                  ,{' '}
                  <Link to="/privacy" target="_blank">
                    Privacy Policy
                  </Link>
                  , Health Waiver and{' '}
                  <Link to="/refunds" target="_blank">
                    Refund Policy
                  </Link>
                  {children.length > 0 ? ' for myself and on behalf of my children' : ''}.
                </>
              }
            />
          </>
        )}
        <ErrorNote error={error} />
        <Button block busy={busy} type="submit">
          {codeStep ? 'Finish' : 'Create account'}
        </Button>
        {!codeStep && (
          <p className="auth__alt">
            Already a member? <Link to="/app/login">Log in</Link>
          </p>
        )}
      </form>
    </main>
  )
}
