// Landing sections that need no studio-specific facts: training pillars, how a class
// flows, kids and parents, plan finder, first visit. Every claim matches what the app does.
import { useEffect, useRef, useState } from 'react'
import { CurlIcon, FlameIcon, PulseIcon, StretchIcon } from './Figures'

// ---------- Training pillars ----------

export function Pillars() {
  const items = [
    { icon: <CurlIcon />, title: 'Strength', text: 'Build muscle and power with coached, progressive training.' },
    { icon: <PulseIcon />, title: 'Stamina', text: 'Raise your heart rate and keep going for longer.' },
    { icon: <StretchIcon />, title: 'Mobility', text: 'Move freely with stretching and control work in every class.' },
    { icon: <FlameIcon />, title: 'Confidence', text: 'Show up, track your streak and feel the change.' },
  ]
  return (
    <section className="section pillars" aria-labelledby="pillars-h">
      <div className="wrap">
        <header className="section__head" data-reveal>
          <p className="eyebrow">What we train</p>
          <h2 id="pillars-h">Four pillars, every session</h2>
        </header>
        <div className="pillars__grid">
          {items.map((p, i) => (
            <div key={p.title} className="pillar" data-reveal style={{ transitionDelay: `${i * 80}ms` }}>
              <div className="pillar__icon">{p.icon}</div>
              <span className="pillar__n">0{i + 1}</span>
              <h3>{p.title}</h3>
              <p>{p.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------- Inside a class: scroll-linked progress ring ----------

const PHASES = [
  { name: 'Warm-up', text: 'Raise your temperature and get your joints moving so you train safely.', icon: <PulseIcon /> },
  { name: 'Skill and strength', text: 'Coached technique first, then strength work matched to your level.', icon: <CurlIcon /> },
  { name: 'Conditioning', text: 'The sweaty part: intervals and circuits to build stamina.', icon: <FlameIcon /> },
  { name: 'Cool-down', text: 'Stretch, breathe and recover, ready for the next session.', icon: <StretchIcon /> },
]

export function ClassFlow() {
  const ref = useRef<HTMLElement>(null)
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0
    // Progress follows the phase cards: a card counts once its top passes the middle of the screen
    const on = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const cards = [...el.querySelectorAll<HTMLElement>('.flow__item')]
        const mid = window.innerHeight * 0.55
        let p = 0
        cards.forEach((c, i) => {
          const r = c.getBoundingClientRect()
          const f = Math.min(1, Math.max(0, (mid - r.top) / Math.max(1, r.height)))
          if (f > 0) p = Math.max(p, (i + f) / cards.length)
        })
        setProgress(p)
      })
    }
    on()
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => {
      window.removeEventListener('scroll', on)
      window.removeEventListener('resize', on)
      cancelAnimationFrame(raf)
    }
  }, [])
  const active = Math.min(PHASES.length - 1, Math.floor(progress * PHASES.length * 0.999))
  const C = 2 * Math.PI * 88
  return (
    <section className="section section--alt flow" ref={ref} aria-labelledby="flow-h">
      <div className="wrap flow__grid">
        <div className="flow__sticky">
          <header className="section__head section__head--left">
            <p className="eyebrow">Inside a class</p>
            <h2 id="flow-h">Every session has a plan</h2>
          </header>
          <div className="ring" aria-hidden="true">
            <svg viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="88" className="ring__track" />
              <circle cx="100" cy="100" r="88" className="ring__fill" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} />
              {PHASES.map((_, i) => {
                const a = (i / PHASES.length) * Math.PI * 2 - Math.PI / 2
                return <circle key={i} cx={100 + 88 * Math.cos(a)} cy={100 + 88 * Math.sin(a)} r="7" className={`ring__dot ${i <= active ? 'on' : ''}`} />
              })}
            </svg>
            <div className="ring__label">
              <span className="ring__step">0{active + 1}</span>
              <strong>{PHASES[active].name}</strong>
            </div>
          </div>
        </div>
        <ol className="flow__list">
          {PHASES.map((p, i) => (
            <li key={p.name} className={`flow__item ${i === active ? 'is-active' : ''} ${i < active ? 'is-done' : ''}`}>
              <div className="flow__icon">{p.icon}</div>
              <div>
                <span className="flow__n">Phase 0{i + 1}</span>
                <h3>{p.name}</h3>
                <p>{p.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

// ---------- Kids and parents (matches app behaviour, PRD 8.2) ----------

export function KidsSection() {
  const items = [
    { t: 'One parent account', d: 'Add every child to your account. You book, pay and see their attendance in one place.' },
    { t: 'Kids classes only', d: 'Children can only be booked into classes made for kids.' },
    { t: 'Their QR on your phone', d: 'Show each child’s check-in code from your phone. Children don’t need a login.' },
    { t: 'Coaches can reach you', d: 'If something comes up in class, the coach can call you straight from the app.' },
    { t: 'Private by design', d: 'No ads, no weight tracking and no profiling for children. Photos only with your consent.' },
    { t: 'Progress you can see', d: 'Classes attended, weekly streaks and classes left, always up to date.' },
  ]
  return (
    <section className="section kids" aria-labelledby="kids-h">
      <div className="wrap">
        <header className="section__head" data-reveal>
          <p className="eyebrow">For parents</p>
          <h2 id="kids-h">Built for kids, easy for parents</h2>
        </header>
        <div className="kids__grid">
          {items.map((k, i) => (
            <div key={k.t} className="card kids__item" data-reveal style={{ transitionDelay: `${(i % 3) * 80}ms` }}>
              <span className="kids__tick" aria-hidden="true">✓</span>
              <h3>{k.t}</h3>
              <p>{k.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------- Plan finder quiz ----------

type Answer = { who?: 'self' | 'child'; goal?: 'strong' | 'fit' | 'fun' | 'coach'; where?: 'studio' | 'online' | 'either' }

const QUESTIONS = [
  { key: 'who', q: 'Who is training?', options: [['self', 'Me'], ['child', 'My child']] },
  { key: 'goal', q: 'What matters most?', options: [['strong', 'Getting stronger'], ['fit', 'Getting fitter'], ['fun', 'Training with a group'], ['coach', 'Close coaching']] },
  { key: 'where', q: 'Where do you want to train?', options: [['studio', 'At the studio'], ['online', 'Online'], ['either', 'Either']] },
] as const

export function PlanQuiz({ plans }: { plans: { id: string; name: string; price: string; per: string }[] }) {
  const [a, setA] = useState<Answer>({})
  const [step, setStep] = useState(0)
  const done = step >= QUESTIONS.length
  const program = a.who === 'child' ? 'kids' : a.goal === 'coach' || a.goal === 'strong' ? 'adult' : 'group'
  const planName = program === 'kids' ? 'Kids Training' : program === 'adult' ? 'Adult Training' : 'Group Classes'
  const plan = plans.find((p) => p.name === planName)
  const why =
    program === 'kids'
      ? 'Coach-led sessions made for children, 3 a week, with you in control of bookings.'
      : program === 'adult'
        ? 'Small batches and close attention to your form and progress. Group classes are included too.'
        : 'High-energy sessions with the crew, at the studio or live online.'
  const pick = (key: string, value: string) => {
    setA({ ...a, [key]: value })
    setStep(step + 1)
  }
  const book = () => {
    window.dispatchEvent(new CustomEvent('unifit:program', { detail: program }))
    document.getElementById('trial')?.scrollIntoView({ behavior: 'smooth' })
  }
  return (
    <section className="section quiz" aria-labelledby="quiz-h">
      <div className="wrap quiz__wrap">
        <header className="section__head" data-reveal>
          <p className="eyebrow">Plan finder</p>
          <h2 id="quiz-h">Find your plan in 3 taps</h2>
        </header>
        <div className="card quiz__card" data-reveal>
          <div className="quiz__bar" aria-hidden="true">
            {QUESTIONS.map((_, i) => (
              <span key={i} className={i < step ? 'on' : ''} />
            ))}
          </div>
          {!done ? (
            <div key={step} className="quiz__step" aria-live="polite">
              <p className="quiz__count">
                Question {step + 1} of {QUESTIONS.length}
              </p>
              <h3>{QUESTIONS[step].q}</h3>
              <div className="quiz__opts">
                {QUESTIONS[step].options.map(([v, label]) => (
                  <button key={v} className="quiz__opt" onClick={() => pick(QUESTIONS[step].key, v)}>
                    {label}
                  </button>
                ))}
              </div>
              {step > 0 && (
                <button className="quiz__back" onClick={() => setStep(step - 1)}>
                  ← Back
                </button>
              )}
            </div>
          ) : (
            <div className="quiz__result" aria-live="polite">
              <p className="quiz__count">Your match</p>
              <h3>{planName}</h3>
              {plan && (
                <p className="quiz__price">
                  {plan.price} <small>{plan.per}</small>
                </p>
              )}
              <p className="muted">{why}</p>
              {a.where === 'online' && program !== 'adult' && <p className="muted">Pick the online classes when you book.</p>}
              <div className="quiz__actions">
                <button className="btn btn--primary" onClick={book}>
                  Book a free trial
                </button>
                <button className="btn btn--ghost" onClick={() => (setA({}), setStep(0))}>
                  Start again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

// ---------- First visit checklist ----------

const CHECKLIST = [
  ['Wear comfortable workout clothes', 'Something you can move, bend and sweat in.'],
  ['Bring a water bottle and a small towel', 'You will need both by the conditioning phase.'],
  ['Arrive 10 minutes early', 'Time to meet your coach and settle in.'],
  ['Tell your coach about any injuries', 'So every exercise can be adjusted for you.'],
  ['Show your QR at the door', 'Open My QR in the app. It takes a second to check in.'],
]

export function FirstVisit() {
  const list = useRef<HTMLOListElement>(null)
  const [ticked, setTicked] = useState(0)
  useEffect(() => {
    const items = list.current?.querySelectorAll('li')
    if (!items) return
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setTicked((t) => Math.max(t, Number((e.target as HTMLElement).dataset.i) + 1))),
      { rootMargin: '0px 0px -35% 0px' },
    )
    items.forEach((li) => io.observe(li))
    return () => io.disconnect()
  }, [])
  return (
    <section className="section section--alt visit" aria-labelledby="visit-h">
      <div className="wrap visit__grid">
        <header className="section__head section__head--left" data-reveal>
          <p className="eyebrow">Your first visit</p>
          <h2 id="visit-h">Ready, set, train</h2>
          <p className="muted">Everything you need for your first class, in five steps.</p>
          <a href="#trial" className="btn btn--primary">
            Book a free trial
          </a>
        </header>
        <ol className="checklist" ref={list}>
          {CHECKLIST.map(([t, d], i) => (
            <li key={t} data-i={i} className={i < ticked ? 'is-done' : ''}>
              <span className="checklist__box" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              </span>
              <div>
                <strong>{t}</strong>
                <p>{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
