// Animated exercise figures in brand colours. Hand-drawn SVG, animated with SMIL
// (no licensed assets). Animations pause off-screen and for reduced motion.
import { useEffect, useRef, type ReactNode } from 'react'

function Animated({ children, viewBox = '0 0 120 140', label, className = '' }: { children: ReactNode; viewBox?: string; label: string; className?: string }) {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    const svg = ref.current
    if (!svg) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      svg.pauseAnimations()
      svg.setCurrentTime(0.6)
      return
    }
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? svg.unpauseAnimations() : svg.pauseAnimations()))
    io.observe(svg)
    return () => io.disconnect()
  }, [])
  return (
    <svg ref={ref} viewBox={viewBox} className={`fig ${className}`} role="img" aria-label={label}>
      {children}
    </svg>
  )
}

const S = { stroke: 'currentColor', strokeWidth: 9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' }
const ACCENT = 'var(--green)'

/** One jumping jack: arms swing overhead while legs open */
function JackBody({ dur = '0.9s', begin = '0s' }: { dur?: string; begin?: string }) {
  return (
    <g>
      <animateTransform attributeName="transform" type="translate" values="0 0;0 -7;0 0" keyTimes="0;0.5;1" dur={dur} begin={begin} repeatCount="indefinite" />
      <circle cx="60" cy="20" r="11" fill={ACCENT} />
      <line x1="60" y1="36" x2="60" y2="80" {...S} />
      <line x1="60" y1="42" x2="38" y2="72" {...S}>
        <animate attributeName="x2" values="38;30;38" keyTimes="0;0.5;1" dur={dur} begin={begin} repeatCount="indefinite" />
        <animate attributeName="y2" values="72;8;72" keyTimes="0;0.5;1" dur={dur} begin={begin} repeatCount="indefinite" />
      </line>
      <line x1="60" y1="42" x2="82" y2="72" {...S}>
        <animate attributeName="x2" values="82;90;82" keyTimes="0;0.5;1" dur={dur} begin={begin} repeatCount="indefinite" />
        <animate attributeName="y2" values="72;8;72" keyTimes="0;0.5;1" dur={dur} begin={begin} repeatCount="indefinite" />
      </line>
      <line x1="60" y1="80" x2="52" y2="128" {...S}>
        <animate attributeName="x2" values="52;34;52" keyTimes="0;0.5;1" dur={dur} begin={begin} repeatCount="indefinite" />
      </line>
      <line x1="60" y1="80" x2="68" y2="128" {...S}>
        <animate attributeName="x2" values="68;86;68" keyTimes="0;0.5;1" dur={dur} begin={begin} repeatCount="indefinite" />
      </line>
    </g>
  )
}

/** Kids: skipping with a rope that swings over the head and under the feet */
export function SkipFigure() {
  const dur = '0.8s'
  return (
    <Animated label="Animated figure skipping rope">
      <g>
        <animateTransform attributeName="transform" type="translate" values="0 2;0 -10;0 2" keyTimes="0;0.5;1" dur={dur} repeatCount="indefinite" />
        <circle cx="60" cy="26" r="11" fill={ACCENT} />
        <line x1="60" y1="42" x2="60" y2="84" {...S} />
        <polyline points="60,48 44,66 38,76" {...S} />
        <polyline points="60,48 76,66 82,76" {...S} />
        <polyline points="60,84 52,106 54,128" {...S} />
        <polyline points="60,84 68,106 66,128" {...S} />
        <path stroke="var(--yellow)" strokeWidth="4" fill="none" strokeLinecap="round" d="M38 76 Q60 150 82 76">
          <animate attributeName="d" dur={dur} repeatCount="indefinite" values="M38 76 Q60 150 82 76;M38 76 Q60 -30 82 76;M38 76 Q60 150 82 76" keyTimes="0;0.5;1" />
        </path>
      </g>
      <ellipse cx="60" cy="134" rx="22" ry="3" fill="currentColor" opacity=".18" />
    </Animated>
  )
}

/** Adult training: overhead barbell press */
export function PressFigure() {
  const dur = '1.6s'
  const kt = '0;0.45;0.55;1'
  return (
    <Animated label="Animated figure pressing a barbell overhead">
      <circle cx="60" cy="30" r="11" fill={ACCENT} />
      <line x1="60" y1="46" x2="60" y2="88" {...S} />
      <polyline points="60,88 48,108 46,132" {...S} />
      <polyline points="60,88 72,108 74,132" {...S} />
      {/* arms: shoulder to hand, hands follow the bar */}
      <line x1="60" y1="50" x2="34" y2="48" {...S}>
        <animate attributeName="y2" values="48;10;10;48" keyTimes={kt} dur={dur} repeatCount="indefinite" />
      </line>
      <line x1="60" y1="50" x2="86" y2="48" {...S}>
        <animate attributeName="y2" values="48;10;10;48" keyTimes={kt} dur={dur} repeatCount="indefinite" />
      </line>
      <g>
        <animateTransform attributeName="transform" type="translate" values="0 0;0 -38;0 -38;0 0" keyTimes={kt} dur={dur} repeatCount="indefinite" />
        <line x1="10" y1="48" x2="110" y2="48" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        <rect x="8" y="34" width="10" height="28" rx="3" fill={ACCENT} />
        <rect x="102" y="34" width="10" height="28" rx="3" fill={ACCENT} />
        <rect x="18" y="38" width="6" height="20" rx="2" fill="var(--yellow)" />
        <rect x="96" y="38" width="6" height="20" rx="2" fill="var(--yellow)" />
      </g>
    </Animated>
  )
}

/** Group classes: three people doing jumping jacks in sync */
export function GroupFigure() {
  return (
    <Animated viewBox="0 0 300 140" label="Three animated figures doing jumping jacks together">
      <g transform="translate(0 6) scale(.9)">
        <JackBody />
      </g>
      <g transform="translate(96 0)">
        <JackBody begin="0.15s" />
      </g>
      <g transform="translate(192 6) scale(.9)">
        <JackBody begin="0.3s" />
      </g>
    </Animated>
  )
}

/** Small looping icons for pillars and class phases */
export function CurlIcon() {
  return (
    <Animated viewBox="0 0 64 64" label="Dumbbell curl" className="fig--icon">
      <line x1="22" y1="14" x2="22" y2="40" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      <g>
        <animateTransform attributeName="transform" type="rotate" values="0 22 40;-115 22 40;0 22 40" dur="1.4s" repeatCount="indefinite" />
        <line x1="22" y1="40" x2="46" y2="40" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
        <rect x="42" y="30" width="8" height="20" rx="2" fill={ACCENT} />
      </g>
    </Animated>
  )
}

export function PulseIcon() {
  return (
    <Animated viewBox="0 0 64 64" label="Heartbeat" className="fig--icon">
      <path d="M32 52 C10 38 6 26 14 18 C20 12 28 14 32 21 C36 14 44 12 50 18 C58 26 54 38 32 52Z" fill={ACCENT}>
        <animateTransform attributeName="transform" type="scale" values="1;1.1;1;1.06;1" keyTimes="0;0.15;0.3;0.45;1" dur="1.1s" repeatCount="indefinite" additive="sum" />
      </path>
      <polyline points="6,34 20,34 25,26 31,42 36,30 40,34 58,34" fill="none" stroke="var(--bg)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </Animated>
  )
}

export function StretchIcon() {
  return (
    <Animated viewBox="0 0 64 64" label="Stretch" className="fig--icon">
      <circle cx="32" cy="12" r="6" fill={ACCENT} />
      <line x1="32" y1="20" x2="32" y2="40" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <polyline points="32,40 22,58" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <polyline points="32,40 42,58" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <g>
        <animateTransform attributeName="transform" type="rotate" values="-18 32 30;18 32 30;-18 32 30" dur="3s" repeatCount="indefinite" />
        <line x1="32" y1="24" x2="18" y2="4" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        <line x1="32" y1="24" x2="46" y2="4" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      </g>
    </Animated>
  )
}

export function FlameIcon() {
  return (
    <Animated viewBox="0 0 64 64" label="Flame" className="fig--icon">
      <path fill="var(--yellow)" d="M32 6 C40 20 50 26 48 40 C46 52 38 58 32 58 C24 58 16 52 16 42 C16 32 24 28 26 18 C30 24 30 28 32 30 C34 22 32 14 32 6Z">
        <animate attributeName="d" dur="1.2s" repeatCount="indefinite" values="M32 6 C40 20 50 26 48 40 C46 52 38 58 32 58 C24 58 16 52 16 42 C16 32 24 28 26 18 C30 24 30 28 32 30 C34 22 32 14 32 6Z;M33 8 C42 22 48 28 47 41 C45 52 38 58 32 58 C24 58 17 52 17 42 C17 33 23 27 27 20 C30 25 31 29 33 31 C35 23 34 15 33 8Z;M32 6 C40 20 50 26 48 40 C46 52 38 58 32 58 C24 58 16 52 16 42 C16 32 24 28 26 18 C30 24 30 28 32 30 C34 22 32 14 32 6Z" />
      </path>
      <path fill={ACCENT} d="M32 34 C36 40 40 44 38 50 C37 54 34 56 32 56 C28 56 26 53 26 49 C26 44 30 42 32 34Z" />
    </Animated>
  )
}

/** Heart-rate line drawn across the hero */
export function HeartbeatLine() {
  return (
    <svg className="ecg" viewBox="0 0 1200 120" preserveAspectRatio="none" aria-hidden="true">
      <path
        className="ecg__path"
        d="M0 70 H300 L320 70 L335 40 L350 100 L368 10 L388 110 L404 60 L420 70 H700 L720 70 L735 40 L750 100 L768 10 L788 110 L804 60 L820 70 H1200"
        fill="none"
        stroke="var(--green)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
      />
    </svg>
  )
}
