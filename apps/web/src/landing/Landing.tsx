import { lazy, Suspense, useEffect, useState, type FormEvent, type PointerEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LogoLockup, Mark } from '../brand/Logo'
import { plans, studio } from '../config'
import { ThemeToggle } from '../ThemeToggle'
import { GroupFigure, HeartbeatLine, PressFigure, SkipFigure } from './Figures'
import { ClassFlow, FirstVisit, KidsSection, Pillars, PlanQuiz } from './FitnessSections'
import './landing.css'
import './fitness.css'

const Hero3D = lazy(() => import('./Hero3D'))

function canUse3D() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

// Fade and lift sections into view as they scroll in
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('[data-reveal]')
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            io.unobserve(e.target)
          }
        }),
      { threshold: 0.15 },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
}

// Card that tilts in 3D toward the pointer
function Tilt({ children, className = '' }: { children: ReactNode; className?: string }) {
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return
    const r = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    e.currentTarget.style.setProperty('--ry', `${x * 14}deg`)
    e.currentTarget.style.setProperty('--rx', `${-y * 14}deg`)
    e.currentTarget.style.setProperty('--gx', `${(x + 0.5) * 100}%`)
    e.currentTarget.style.setProperty('--gy', `${(y + 0.5) * 100}%`)
  }
  const onLeave = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.style.setProperty('--ry', '0deg')
    e.currentTarget.style.setProperty('--rx', '0deg')
  }
  return (
    <div className={`tilt ${className}`} onPointerMove={onMove} onPointerLeave={onLeave}>
      {children}
    </div>
  )
}

function Nav() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  const links = [
    ['#programs', 'Programs'],
    ['#how', 'How it works'],
    ['#plans', 'Plans'],
    ['#faq', 'FAQ'],
  ]
  return (
    <header className={`nav ${scrolled ? 'nav--solid' : ''}`}>
      <div className="wrap nav__inner">
        <a href="#top" className="nav__logo" aria-label="Unifit.hyd home">
          <LogoLockup height={34} />
        </a>
        <nav className={`nav__links ${open ? 'is-open' : ''}`} aria-label="Main">
          {links.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setOpen(false)}>
              {label}
            </a>
          ))}
          <Link to="/app" className="nav__login">
            Log in
          </Link>
        </nav>
        <div className="nav__actions">
          <ThemeToggle />
          <a href="#trial" className="btn btn--primary btn--sm">
            Free trial
          </a>
          <button className="nav__burger" aria-expanded={open} aria-label="Menu" onClick={() => setOpen(!open)}>
            <span />
            <span />
          </button>
        </div>
      </div>
    </header>
  )
}

function Hero() {
  const [show3D] = useState(canUse3D)
  return (
    <section className="hero" id="top">
      <div className="hero__glow" aria-hidden="true" />
      <div className="hero__floor" aria-hidden="true" />
      <HeartbeatLine />
      <div className="wrap hero__grid">
        <div className="hero__copy">
          <p className="eyebrow">
            <span className="dot" /> {studio.city} · Studio and online
          </p>
          <h1 className="hero__title">
            Train.
            <br />
            <span className="accent">Transform.</span>
            <br />
            Thrive.
          </h1>
          <p className="hero__lead">
            Coach-led training for kids and adults. Book your class in seconds, check in with a scan, and pay by UPI.
            All in one app.
          </p>
          <div className="hero__cta">
            <a href="#trial" className="btn btn--primary">
              Book a free trial
            </a>
            <a href="#plans" className="btn btn--ghost">
              See plans
            </a>
          </div>
          <ul className="hero__chips" aria-label="Highlights">
            <li>Kids and adults</li>
            <li>Studio and online</li>
            <li>UPI payments</li>
          </ul>
        </div>
        <div className="hero__visual">
          {show3D ? (
            <Suspense fallback={<StaticMark />}>
              <Hero3D />
            </Suspense>
          ) : (
            <StaticMark />
          )}
        </div>
      </div>
      <a href="#programs" className="hero__scroll" aria-label="Scroll to programs">
        <span />
      </a>
    </section>
  )
}

function StaticMark() {
  return (
    <div className="static-mark">
      <Mark size={260} />
    </div>
  )
}

function Marquee() {
  const words = ['Train', 'Transform', 'Thrive']
  const row = Array.from({ length: 6 }, () => words).flat()
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee__track">
        {[...row, ...row].map((w, i) => (
          <span key={i}>
            {w} <i>•</i>
          </span>
        ))}
      </div>
    </div>
  )
}

function Programs() {
  const items = [
    {
      id: 'kids' as const,
      title: 'Kids Training',
      text: 'Fun, structured sessions that build strength, coordination and confidence. Parents book and track everything from one account.',
      tag: '3 classes a week',
    },
    {
      id: 'adult' as const,
      title: 'Adult Training',
      text: 'Small-batch coaching with close attention to form and progress, built around your goals.',
      tag: 'Small batches',
    },
    {
      id: 'group' as const,
      title: 'Group Classes',
      text: 'High-energy sessions with the whole crew. Join at the studio or live online from home.',
      tag: 'Studio and online',
    },
  ]
  return (
    <section className="section" id="programs">
      <div className="wrap">
        <header className="section__head" data-reveal>
          <p className="eyebrow">Programs</p>
          <h2>Pick your way to train</h2>
        </header>
        <div className="grid-3">
          {items.map((p, i) => (
            <div key={p.id} data-reveal style={{ transitionDelay: `${i * 90}ms` }}>
              <Tilt className="card program">
                <div className={`program__stage program__stage--${p.id}`}>{p.id === 'kids' ? <SkipFigure /> : p.id === 'adult' ? <PressFigure /> : <GroupFigure />}</div>
                <h3>{p.title}</h3>
                <p>{p.text}</p>
                <span className="pill">{p.tag}</span>
              </Tilt>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function PhoneMock() {
  return (
    <div className="phone" aria-hidden="true">
      <div className="phone__screen">
        <div className="phone__top">
          <Mark size={18} />
          <span>Today</span>
        </div>
        <div className="phone__class">
          <span className="badge badge--studio">Studio</span>
          <strong>Group Classes</strong>
          <small>6:00 pm · 8 spots left</small>
          <span className="phone__btn">Booked ✓</span>
        </div>
        <div className="phone__class">
          <span className="badge badge--online">Online</span>
          <strong>Kids Training</strong>
          <small>5:00 pm · 3 spots left</small>
          <span className="phone__btn phone__btn--ghost">Book</span>
        </div>
        <div className="phone__qr">
          <div className="qr">
            {Array.from({ length: 49 }, (_, i) => (
              <i key={i} className={(i * 7 + (i % 5) * 3) % 3 === 0 || [0, 6, 42, 48, 24].includes(i) ? 'on' : ''} />
            ))}
          </div>
          <small>Show at the door</small>
        </div>
      </div>
    </div>
  )
}

function HowItWorks() {
  const steps = [
    ['Book', 'Pick a class from the live timetable. You see spots left and classes left on your plan.'],
    ['Check in', 'Show your QR at the studio, or type the class code when you join online.'],
    ['Train', 'Get reminders before class and track your attendance streak.'],
    ['Pay by UPI', 'Scan or tap to pay. Your member code is filled in, and your receipt arrives once confirmed.'],
  ]
  return (
    <section className="section section--alt" id="how">
      <div className="wrap how">
        <div className="how__visual" data-reveal>
          <PhoneMock />
        </div>
        <div>
          <header className="section__head section__head--left" data-reveal>
            <p className="eyebrow">The Unifit app</p>
            <h2>Everything in your pocket</h2>
          </header>
          <ol className="steps">
            {steps.map(([t, d], i) => (
              <li key={t} data-reveal style={{ transitionDelay: `${i * 80}ms` }}>
                <span className="steps__n">{i + 1}</span>
                <div>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}

function Modes() {
  return (
    <section className="section">
      <div className="wrap grid-2">
        <div data-reveal>
          <Tilt className="card mode mode--studio">
            <span className="badge badge--studio">Studio</span>
            <h3>Train with us in {studio.city}</h3>
            <p>Coach-led sessions at the studio. Check in with a quick scan at the door.</p>
          </Tilt>
        </div>
        <div data-reveal style={{ transitionDelay: '90ms' }}>
          <Tilt className="card mode mode--online">
            <span className="badge badge--online">Online</span>
            <h3>Join live from anywhere</h3>
            <p>The class link appears 30 minutes before start, only for members who booked.</p>
          </Tilt>
        </div>
      </div>
    </section>
  )
}

type PublicClass = { id: string; title: string; program: string; startsAt: string; mode: 'ONLINE' | 'OFFLINE'; spotsLeft: number }

function Schedule() {
  const [classes, setClasses] = useState<PublicClass[] | 'error' | null>(null)
  useEffect(() => {
    fetch('/api/public/schedule')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { classes: PublicClass[] }) => setClasses(d.classes))
      .catch(() => setClasses('error'))
  }, [])
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('en-IN', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })
  return (
    <section className="section section--alt" id="schedule">
      <div className="wrap">
        <header className="section__head" data-reveal>
          <p className="eyebrow">Schedule</p>
          <h2>This week at Unifit</h2>
        </header>
        {classes === null ? (
          <p className="muted center">Loading the timetable…</p>
        ) : classes === 'error' || classes.length === 0 ? (
          <div className="card empty" data-reveal>
            <Mark size={40} />
            <h3>{classes === 'error' ? 'The timetable could not load' : 'No classes open this week yet'}</h3>
            <p>
              {classes === 'error'
                ? 'Please refresh the page in a moment. You can still ask for a free trial and we will call you.'
                : 'New classes are added every week. Ask for a free trial and we will find a time that suits you.'}
            </p>
            <a className="btn btn--primary" href="#trial">
              Book a free trial
            </a>
          </div>
        ) : (
          <ul className="schedule" data-reveal>
            {classes.map((c) => (
              <li key={c.id} className="card schedule__row">
                <span className={`badge ${c.mode === 'ONLINE' ? 'badge--online' : 'badge--studio'}`}>
                  {c.mode === 'ONLINE' ? 'Online' : 'Studio'}
                </span>
                <strong>{c.title}</strong>
                <span className="muted">{fmt(c.startsAt)}</span>
                <span className="muted">{c.spotsLeft > 0 ? `${c.spotsLeft} spots left` : 'Full'}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

type PublicPlan = { id: string; name: string; shortCode: string; pricePaise: number; cycleMonths: number; creditsPerCycle: number | null; weeklyCap: number | null }

// WEB-2: prices come from the same plan records as the app; config.ts is the fallback copy
function usePlans() {
  const [list, setList] = useState(plans)
  useEffect(() => {
    fetch('/api/public/plans')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { plans: PublicPlan[] }) => {
        if (!d.plans.length) return
        setList(
          d.plans.map((p) => {
            const copy = plans.find((c) => c.name === p.name)
            const price = `₹${(p.pricePaise / 100).toLocaleString('en-IN')}`
            return {
              id: p.id,
              name: p.name,
              price: copy?.price.startsWith('From') ? `From ${price}` : price,
              per: p.cycleMonths === 1 ? 'a month' : `for ${p.cycleMonths} months`,
              points: copy?.points ?? [p.creditsPerCycle ? `${p.creditsPerCycle} classes a cycle${p.weeklyCap ? `, ${p.weeklyCap} a week` : ''}` : 'Unlimited classes'],
              featured: copy?.featured ?? false,
            }
          }),
        )
      })
      .catch(() => {})
  }, [])
  return list
}

function Plans({ plans }: { plans: ReturnType<typeof usePlans> }) {
  return (
    <section className="section" id="plans">
      <div className="wrap">
        <header className="section__head" data-reveal>
          <p className="eyebrow">Plans</p>
          <h2>Simple monthly plans</h2>
          <p className="muted">Pay by UPI from any app. Your first class is free.</p>
        </header>
        <div className="grid-3">
          {plans.map((p, i) => (
            <div key={p.id} data-reveal style={{ transitionDelay: `${i * 90}ms` }}>
              <Tilt className={`card plan ${p.featured ? 'plan--featured' : ''}`}>
                {p.featured && <span className="plan__flag">Most personal</span>}
                <h3>{p.name}</h3>
                <p className="plan__price">
                  {p.price} <small>{p.per}</small>
                </p>
                <ul>
                  {p.points.map((pt) => (
                    <li key={pt}>{pt}</li>
                  ))}
                </ul>
                <a href="#trial" className={`btn ${p.featured ? 'btn--primary' : 'btn--ghost'} btn--block`}>
                  Start with a free trial
                </a>
              </Tilt>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Faq() {
  const items = [
    ['How do I book a class?', 'Join, pick a plan, then book from the timetable in the app. You will get a confirmation and a reminder 2 hours before class.'],
    ['Can I cancel?', 'Yes. Cancel up to 2 hours before the class and the class goes back to your plan. Later cancellations and no-shows use up the class.'],
    ['How do I pay?', 'By UPI. The app shows a QR with the exact amount and your member code. After paying, enter the UPI reference number and you get a receipt once the studio confirms.'],
    ['Can my child join?', 'Yes. A parent creates the account and adds each child. Kids Training is 3 classes a week, and the parent books, pays and shows the check-in QR.'],
    ['How do online classes work?', 'Book like any other class. The join link appears 30 minutes before start. Type the code your coach shows to mark your attendance.'],
    ['What if the studio cancels a class?', 'You get the class back plus a make-up class, and we notify you straight away.'],
  ]
  return (
    <section className="section section--alt" id="faq">
      <div className="wrap faq">
        <header className="section__head" data-reveal>
          <p className="eyebrow">FAQ</p>
          <h2>Good to know</h2>
        </header>
        <div className="faq__list" data-reveal>
          {items.map(([q, a]) => (
            <details key={q} className="card faq__item">
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

function Trial() {
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    if (form.get('website')) return // honeypot (LEAD-6)
    const phone = String(form.get('phone') || '').replace(/\D/g, '').slice(-10)
    if (phone.length !== 10) {
      setError('Please enter a 10-digit mobile number.')
      return
    }
    setError('')
    setState('sending')
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.get('name'),
          phone,
          program: form.get('program'),
          forWhom: form.get('forWhom'),
          childAge: form.get('childAge') || undefined,
          preferredTime: form.get('preferredTime'),
          source: 'website',
        }),
      })
      if (!res.ok) throw new Error()
      setState('done')
    } catch {
      setState('error')
    }
  }
  const [forWhom, setForWhom] = useState('self')
  const [program, setProgram] = useState('group')
  useEffect(() => {
    const on = (e: Event) => {
      const p = (e as CustomEvent<string>).detail
      setProgram(p)
      setForWhom(p === 'kids' ? 'child' : 'self')
    }
    window.addEventListener('unifit:program', on)
    return () => window.removeEventListener('unifit:program', on)
  }, [])
  return (
    <section className="section trial" id="trial">
      <div className="wrap trial__grid">
        <div data-reveal>
          <p className="eyebrow">Free trial</p>
          <h2>Your first class is on us</h2>
          <p className="muted">
            Tell us a little about you and we will book you into a class that fits. One free trial per phone number.
          </p>
          {studio.whatsapp && (
            <a className="btn btn--ghost" href={`https://wa.me/${studio.whatsapp}`} target="_blank" rel="noreferrer">
              Chat on WhatsApp
            </a>
          )}
        </div>
        <div data-reveal style={{ transitionDelay: '90ms' }}>
          {state === 'done' ? (
            <div className="card trial__done" role="status">
              <Mark size={48} />
              <h3>Thanks, you are on the list</h3>
              <p>We will message you shortly to confirm your trial class.</p>
            </div>
          ) : (
            <form className="card form" onSubmit={submit} noValidate>
              <label>
                Name
                <input name="name" required autoComplete="name" />
              </label>
              <label>
                Mobile number
                <input name="phone" required inputMode="tel" autoComplete="tel" placeholder="10-digit number" />
              </label>
              <div className="form__row">
                <label>
                  Program
                  <select name="program" value={program} onChange={(e) => setProgram(e.target.value)}>
                    <option value="group">Group Classes</option>
                    <option value="kids">Kids Training</option>
                    <option value="adult">Adult Training</option>
                  </select>
                </label>
                <label>
                  For
                  <select name="forWhom" value={forWhom} onChange={(e) => setForWhom(e.target.value)}>
                    <option value="self">Me</option>
                    <option value="child">My child</option>
                  </select>
                </label>
              </div>
              {forWhom === 'child' && (
                <label>
                  Child's age
                  <input name="childAge" inputMode="numeric" maxLength={2} />
                </label>
              )}
              <label>
                Preferred time
                <select name="preferredTime" defaultValue="evening">
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="evening">Evening</option>
                </select>
              </label>
              <input name="website" tabIndex={-1} autoComplete="off" className="hp" aria-hidden="true" />
              {error && <p className="form__error">{error}</p>}
              {state === 'error' && (
                <p className="form__error" role="alert">
                  We could not send that just now. Please try again in a moment.
                </p>
              )}
              <button className="btn btn--primary btn--block" disabled={state === 'sending'}>
                {state === 'sending' ? 'Sending…' : 'Book my free trial'}
              </button>
              <p className="form__note">
                By sending this you agree to be contacted about your trial. See our <Link to="/privacy">Privacy Policy</Link>.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer__grid">
        <div>
          <LogoLockup height={32} />
          <p className="footer__tag">TRAIN • TRANSFORM • THRIVE</p>
        </div>
        <nav aria-label="Footer">
          <a href="#programs">Programs</a>
          <a href="#plans">Plans</a>
          <a href="#faq">FAQ</a>
          <Link to="/app">Member login</Link>
        </nav>
        <nav aria-label="Legal">
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/refunds">Refund and cancellation</Link>
        </nav>
        <div className="footer__contact">
          {studio.address && <p>{studio.address}</p>}
          {studio.phone && <a href={`tel:${studio.phone}`}>{studio.phone}</a>}
          {studio.email && <a href={`mailto:${studio.email}`}>{studio.email}</a>}
          <p className="muted">{studio.city}</p>
        </div>
      </div>
      <p className="wrap footer__copy">© {new Date().getFullYear()} Unifit.hyd</p>
    </footer>
  )
}

export default function Landing() {
  useReveal()
  const planList = usePlans()
  return (
    <>
      <a href="#programs" className="skip">
        Skip to content
      </a>
      <Nav />
      <main>
        <Hero />
        <Marquee />
        <Pillars />
        <Programs />
        <ClassFlow />
        <HowItWorks />
        <KidsSection />
        <Modes />
        <Schedule />
        <PlanQuiz plans={planList} />
        <Plans plans={planList} />
        <FirstVisit />
        <Faq />
        <Trial />
      </main>
      <Footer />
    </>
  )
}
