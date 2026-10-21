// Shared app components. Colours come from tokens.css; layout from app.css.
import { createContext, useCallback, useContext, useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { ApiError } from './api'

export function Button({ variant = 'primary', size, block, busy, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'quiet'; size?: 'sm'; block?: boolean; busy?: boolean }) {
  return (
    <button {...rest} disabled={rest.disabled || busy} className={`ab ab--${variant} ${size === 'sm' ? 'ab--sm' : ''} ${block ? 'ab--block' : ''} ${rest.className ?? ''}`}>
      {busy ? <span className="spin" aria-hidden="true" /> : null}
      {children}
    </button>
  )
}

export function Field({ label, hint, error, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  return (
    <label className="af">
      <span className="af__label">{label}</span>
      <input {...rest} aria-invalid={!!error} />
      {hint && !error && <span className="af__hint">{hint}</span>}
      {error && <span className="af__error">{error}</span>}
    </label>
  )
}

export function Select({ label, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label className="af">
      <span className="af__label">{label}</span>
      <select {...rest}>{children}</select>
    </label>
  )
}

export function TextArea({ label, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className="af">
      <span className="af__label">{label}</span>
      <textarea {...rest} />
    </label>
  )
}

export function Check({ label, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className="acheck">
      <input type="checkbox" {...rest} />
      <span>{label}</span>
    </label>
  )
}

export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => <div className={`acard ${className}`}>{children}</div>

const STATUS: Record<string, [string, string]> = {
  ACTIVE: ['Paid', 'ok'],
  PAID: ['Paid', 'ok'],
  SCHEDULED: ['Starts soon', 'info'],
  GRACE: ['Renew soon', 'warn'],
  DUE: ['Due', 'bad'],
  NONE: ['No plan', 'muted'],
  FROZEN: ['Paused', 'info'],
  PENDING: ['Pending', 'warn'],
  VERIFIED: ['Verified', 'ok'],
  REJECTED: ['Rejected', 'bad'],
  REVERSED: ['Reversed', 'muted'],
  REFUNDED: ['Refunded', 'muted'],
  BOOKED: ['Booked', 'info'],
  TRIAL: ['Trial', 'info'],
  ATTENDED: ['Attended', 'ok'],
  NO_SHOW: ['No-show', 'bad'],
  CANCELLED: ['Cancelled', 'muted'],
  LATE_CANCELLED: ['Late cancel', 'warn'],
  COMPLETED: ['Done', 'muted'],
  ONLINE: ['Online', 'online'],
  OFFLINE: ['Studio', 'studio'],
  NEW: ['New', 'info'],
  TRIAL_BOOKED: ['Trial booked', 'info'],
  JOINED: ['Joined', 'ok'],
  LOST: ['Lost', 'muted'],
  SENT: ['Sent', 'ok'],
  FAILED: ['Failed', 'bad'],
  QUEUED: ['Queued', 'warn'],
}

/** Status pill: always a word plus colour, never colour alone */
export function Pill({ status, label }: { status: string; label?: string }) {
  const [text, tone] = STATUS[status] ?? [status, 'muted']
  return <span className={`pill2 pill2--${tone}`}>{label ?? text}</span>
}

/**
 * Empty state for a page or section: what belongs here, why it matters, and the one action to start.
 * For filtered views, pass a "Clear filters" action. `compact` fits inside a card or a small section.
 */
export function Empty({ title, children, action, compact }: { title: string; children?: ReactNode; action?: ReactNode; compact?: boolean }) {
  return (
    <div className={`aempty ${compact ? 'aempty--compact' : ''}`} role="status">
      {!compact && (
        <svg viewBox="0 0 315 379.5" aria-hidden="true" width="34">
          <path d="M0 104H105V222A52.5 52.5 0 0 0 157.5 274.5V379.5A157.5 157.5 0 0 1 0 222Z" fill="var(--mark-left)" opacity=".35" />
          <path d="M157.5 379.5V274.5A52.5 52.5 0 0 0 210 222V69L315 0V222A157.5 157.5 0 0 1 157.5 379.5Z" fill="var(--green)" opacity=".6" />
        </svg>
      )}
      <strong>{title}</strong>
      {children && <div className="muted aempty__body">{children}</div>}
      {action && <div className="aempty__act">{action}</div>}
    </div>
  )
}

export const Loading = ({ label = 'Loading…' }: { label?: string }) => (
  <div className="aloading" role="status">
    <span className="spin" aria-hidden="true" /> {label}
  </div>
)

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null
  const msg = error instanceof ApiError || error instanceof Error ? error.message : String(error)
  return (
    <p className="aerror" role="alert">
      {msg}
    </p>
  )
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', k)
      document.body.style.overflow = ''
    }
  }, [onClose])
  return (
    <div className="asheet" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="asheet__panel" onClick={(e) => e.stopPropagation()}>
        <header className="asheet__head">
          <h2>{title}</h2>
          <button className="aicon" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="asheet__body">{children}</div>
      </div>
    </div>
  )
}

export function PageHead({ title, sub, action }: { title: string; sub?: ReactNode; action?: ReactNode }) {
  return (
    <header className="ahead">
      <div>
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {action}
    </header>
  )
}

/** Loads data, exposes reload, error and loading */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const run = useCallback(async () => {
    setLoading(true)
    try {
      setData(await fn())
      setError(null)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  useEffect(() => {
    void run()
  }, [run])
  return { data, error, loading, reload: run, setData }
}

// ---------- Toasts ----------

type Toast = { id: number; text: string; tone: 'ok' | 'bad' }
const ToastCtx = createContext<(text: string, tone?: 'ok' | 'bad') => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((text: string, tone: 'ok' | 'bad' = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, text, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="atoasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`atoast atoast--${t.tone}`}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)

/** Runs an action with busy state and a toast on error */
export function useAction() {
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const run = useCallback(
    async <T,>(key: string, fn: () => Promise<T>, success?: string): Promise<T | undefined> => {
      setBusy(key)
      try {
        const r = await fn()
        if (success) toast(success)
        return r
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Something went wrong', 'bad')
        return undefined
      } finally {
        setBusy(null)
      }
    },
    [toast],
  )
  return { busy, run }
}
