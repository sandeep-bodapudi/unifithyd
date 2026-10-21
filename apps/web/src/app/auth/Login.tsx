// Member login by email code; staff add a password step (ACC-3, ACC-4)
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LogoLockup } from '../../brand/Logo'
import { api } from '../api'
import { useSession } from '../session'
import { Button, ErrorNote, Field } from '../ui'

type Step = 'email' | 'password' | 'code'

export default function Login() {
  const nav = useNavigate()
  const { refresh } = useSession()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [devCode, setDevCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (step === 'email')
      return run(async () => {
        const r = await api.post<{ next: Step; devCode?: string }>('/auth/request-code', { email })
        setDevCode(r.devCode ?? null)
        setStep(r.next)
      })
    if (step === 'password')
      return run(async () => {
        const r = await api.post<{ devCode?: string }>('/auth/staff-password', { email, password })
        setDevCode(r.devCode ?? null)
        setStep('code')
      })
    return run(async () => {
      await api.post('/auth/verify-code', { email, code })
      await refresh()
      nav('/app', { replace: true })
    })
  }

  const resend = () =>
    run(async () => {
      if (password) {
        const r = await api.post<{ devCode?: string }>('/auth/staff-password', { email, password })
        setDevCode(r.devCode ?? null)
      } else {
        const r = await api.post<{ devCode?: string }>('/auth/request-code', { email })
        setDevCode(r.devCode ?? null)
      }
    })

  return (
    <main className="auth">
      <form className="auth__card" onSubmit={submit} noValidate>
        <Link to="/" className="auth__logo" aria-label="Unifit.hyd home">
          <LogoLockup height={40} />
        </Link>
        <p className="auth__tag">TRAIN • TRANSFORM • THRIVE</p>
        <h1>{step === 'code' ? 'Enter your code' : step === 'password' ? 'Staff login' : 'Log in'}</h1>
        {step === 'email' && <p className="muted">We will send a 6-digit code to your email. No password needed.</p>}
        {step === 'password' && <p className="muted">Enter your password. We will then send a code to {email}.</p>}
        {step === 'code' && <p className="muted">We sent a 6-digit code to {email}. It expires in 10 minutes.</p>}

        {step === 'email' && <Field label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />}
        {step === 'password' && <Field label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />}
        {step === 'code' && (
          <Field
            label="Code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            hint={devCode ? `Test code: ${devCode}` : undefined}
            required
            autoFocus
          />
        )}
        <ErrorNote error={error} />
        <Button block busy={busy} type="submit">
          {step === 'code' ? 'Log in' : 'Continue'}
        </Button>
        {step === 'code' && (
          <div className="auth__row">
            <button type="button" className="alink" onClick={resend} disabled={busy}>
              Send a new code
            </button>
            <button type="button" className="alink" onClick={() => (setStep('email'), setCode(''), setPassword(''))}>
              Use another email
            </button>
          </div>
        )}
        {step === 'email' && (
          <p className="auth__alt">
            New to Unifit? <Link to="/app/register">Create an account</Link>
          </p>
        )}
      </form>
    </main>
  )
}
