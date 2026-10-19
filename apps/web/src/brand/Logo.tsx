// Theme-aware logo pieces. Colours come from CSS tokens, so one component
// serves the dark and light themes. Geometry matches brand/logo/*.svg.
import wordmarkRaw from '../../../../brand/logo/unifit-wordmark-dark.svg?raw'

export const MARK_W = 315
export const MARK_H = 379.5
export const MARK_LEFT = 'M0 104H105V222A52.5 52.5 0 0 0 157.5 274.5V379.5A157.5 157.5 0 0 1 0 222Z'
export const MARK_RIGHT = 'M157.5 379.5V274.5A52.5 52.5 0 0 0 210 222V69L315 0V222A157.5 157.5 0 0 1 157.5 379.5Z'

export function Mark({ size = 40, mono = false }: { size?: number; mono?: boolean }) {
  return (
    <svg
      viewBox={`0 0 ${MARK_W} ${MARK_H}`}
      height={size}
      width={(size * MARK_W) / MARK_H}
      aria-hidden="true"
      focusable="false"
    >
      <path d={MARK_LEFT} fill={mono ? 'currentColor' : 'var(--mark-left)'} />
      <path d={MARK_RIGHT} fill={mono ? 'currentColor' : 'var(--mark-right)'} />
    </svg>
  )
}

// The dark artwork uses white for "uni" and slate for ".hyd"; map them to tokens.
const wordmarkThemed = wordmarkRaw
  .replace(/<title>.*?<\/title>/, '')
  .replace(/role="img" aria-label="[^"]*"/, 'aria-hidden="true" focusable="false"')
  .replaceAll('#FFFFFF', 'var(--text)')
  .replaceAll('#9FB4D3', 'var(--word-tail)')
  .replaceAll('#4AA82A', 'var(--green)')

export function Wordmark({ height = 28 }: { height?: number }) {
  return <span className="wordmark" style={{ height }} dangerouslySetInnerHTML={{ __html: wordmarkThemed }} />
}

export function LogoLockup({ height = 36 }: { height?: number }) {
  return (
    <span className="lockup" role="img" aria-label="Unifit.hyd">
      <Mark size={height} />
      <Wordmark height={height * 0.62} />
    </span>
  )
}
