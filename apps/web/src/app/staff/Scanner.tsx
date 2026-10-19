// Camera QR scanner with an offline queue (ATT-2, ATT-3, ATT-6, PWA-6).
// Online: the server checks each scan. Offline: the token signature is checked on
// this device with the studio's public key and the scan is queued for sync.
import { verifyAsync } from '@noble/ed25519'
import jsQR from 'jsqr'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError } from '../api'
import { Button, Pill } from '../ui'

type Person = { profileId: string; name: string; memberCode: string; payStatus?: string; bookingStatus?: string | null }
type ScanResult = { result: 'ok' | 'already' | 'blocked' | 'not_booked' | 'invalid' | 'queued'; message?: string; person?: Person & { kind?: string }; pay?: { status: string; creditsLeft: number | null }; dayPass?: boolean }
type Queued = { classId: string; token: string; deviceScanId: string; scannedAt: string }

const QKEY = 'unifit-scan-queue'
const readQ = (): Queued[] => {
  try {
    return JSON.parse(localStorage.getItem(QKEY) ?? '[]')
  } catch {
    return []
  }
}
const writeQ = (q: Queued[]) => {
  try {
    localStorage.setItem(QKEY, JSON.stringify(q))
  } catch {
    /* storage full or blocked */
  }
}
const b64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0))

/** Offline check: signature, expiry and roster membership */
async function verifyOffline(token: string, publicKey: string, roster: Person[]): Promise<ScanResult> {
  const [body, sig] = token.split('.')
  if (!body || !sig) return { result: 'invalid', message: 'Not a Unifit QR code' }
  const ok = await verifyAsync(b64u(sig), new TextEncoder().encode(body), b64u(publicKey)).catch(() => false)
  if (!ok) return { result: 'invalid', message: 'This QR code is not valid' }
  const payload = JSON.parse(new TextDecoder().decode(b64u(body))) as { p: string; e: number; t: string }
  if (payload.e * 1000 < Date.now()) return { result: 'invalid', message: 'This QR code has expired' }
  const person = roster.find((r) => r.profileId === payload.p)
  if (!person) return { result: 'not_booked', message: 'Not on this class roster (walk-ins need a connection)' }
  return { result: 'queued', person, dayPass: payload.t === 'day' }
}

export function useScanQueue(onSynced?: () => void) {
  const [count, setCount] = useState(readQ().length)
  const sync = useCallback(async () => {
    const q = readQ()
    if (!q.length || !navigator.onLine) return
    try {
      const r = await api.post<{ results: { deviceScanId: string; result: string }[] }>('/attendance/sync', { scans: q })
      const done = new Set(r.results.filter((x) => x.result !== 'error').map((x) => x.deviceScanId))
      writeQ(readQ().filter((x) => !done.has(x.deviceScanId)))
      setCount(readQ().length)
      onSynced?.()
    } catch {
      /* stay queued */
    }
  }, [onSynced])
  useEffect(() => {
    void sync()
    window.addEventListener('online', sync)
    const t = setInterval(sync, 30_000)
    return () => {
      window.removeEventListener('online', sync)
      clearInterval(t)
    }
  }, [sync])
  const add = (item: Queued) => {
    writeQ([...readQ(), item])
    setCount(readQ().length)
  }
  return { count, sync, add }
}

export default function Scanner({ classId, roster, publicKey, onScanned }: { classId: string; roster: Person[]; publicKey: string | null; onScanned: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [camError, setCamError] = useState<string | null>(null)
  const [last, setLast] = useState<ScanResult | null>(null)
  const [pendingWalkIn, setPendingWalkIn] = useState<string | null>(null)
  const recent = useRef(new Map<string, number>())
  const queue = useScanQueue(onScanned)

  const handle = useCallback(
    async (token: string, allowWalkIn = false) => {
      const seen = recent.current.get(token)
      if (!allowWalkIn && seen && Date.now() - seen < 4000) return
      recent.current.set(token, Date.now())
      navigator.vibrate?.(60)
      const deviceScanId = crypto.randomUUID()
      try {
        const r = await api.post<ScanResult>('/attendance/scan', { classId, token, allowWalkIn })
        setLast(r)
        setPendingWalkIn(r.result === 'not_booked' ? token : null)
        if (r.result === 'ok') onScanned()
      } catch (e) {
        if (e instanceof ApiError && e.code === 'OFFLINE') {
          if (!publicKey) return setLast({ result: 'invalid', message: 'Offline and no roster saved. Open this class once with signal first.' })
          const r = await verifyOffline(token, publicKey, roster)
          if (r.result === 'queued') queue.add({ classId, token, deviceScanId, scannedAt: new Date().toISOString() })
          setLast(r)
        } else setLast({ result: 'invalid', message: e instanceof Error ? e.message : 'Scan failed' })
      }
    },
    [classId, onScanned, publicKey, queue, roster],
  )

  useEffect(() => {
    let stream: MediaStream | null = null
    let raf = 0
    let stopped = false
    const Detector = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector
    const detector = Detector ? new Detector({ formats: ['qr_code'] }) : null
    const loop = async () => {
      if (stopped) return
      const v = video.current
      if (v && v.readyState >= 2) {
        let value: string | null = null
        if (detector) {
          const codes = await detector.detect(v).catch(() => [])
          value = codes[0]?.rawValue ?? null
        } else if (canvas.current) {
          const c = canvas.current
          c.width = v.videoWidth
          c.height = v.videoHeight
          const ctx = c.getContext('2d', { willReadFrequently: true })!
          ctx.drawImage(v, 0, 0)
          const img = ctx.getImageData(0, 0, c.width, c.height)
          value = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data ?? null
        }
        if (value) await handle(value)
      }
      raf = window.setTimeout(loop, 180)
    }
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((s) => {
        stream = s
        if (video.current) {
          video.current.srcObject = s
          void video.current.play()
        }
        void loop()
      })
      .catch(() => setCamError('Camera not available. Allow camera access in your browser, or use manual check-in below.'))
    if (!navigator.mediaDevices) setCamError('This browser cannot use the camera. Use manual check-in below.')
    return () => {
      stopped = true
      clearTimeout(raf)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [handle])

  const tone = last?.result === 'ok' || last?.result === 'queued' ? 'ok' : last?.result === 'already' ? 'info' : 'bad'
  return (
    <div className="scanner">
      {camError ? (
        <p className="anote">{camError}</p>
      ) : (
        <div className="scanner__view">
          <video ref={video} playsInline muted />
          <span className="scanner__frame" aria-hidden="true" />
        </div>
      )}
      <canvas ref={canvas} hidden />
      {queue.count > 0 && (
        <p className="anote anote--warn" role="status">
          {queue.count} scan{queue.count === 1 ? '' : 's'} saved offline · will sync when online{' '}
          <button className="alink" onClick={() => void queue.sync()}>
            Sync now
          </button>
        </p>
      )}
      {last && (
        <div className={`scanres scanres--${tone}`} role="status" aria-live="assertive">
          <strong>
            {last.result === 'ok' && '✓ Checked in'}
            {last.result === 'queued' && '✓ Checked in (offline)'}
            {last.result === 'already' && 'Already checked in'}
            {last.result === 'blocked' && 'Not allowed in'}
            {last.result === 'not_booked' && 'Not booked'}
            {last.result === 'invalid' && 'Could not check in'}
          </strong>
          {last.person && (
            <span>
              {last.person.name} · {last.person.memberCode}
            </span>
          )}
          {last.pay && (
            <span>
              <Pill status={last.pay.status} />
              {last.pay.creditsLeft !== null ? ` ${last.pay.creditsLeft} classes left` : ''}
            </span>
          )}
          {last.dayPass && <small>Offline pass</small>}
          {last.message && <small>{last.message}</small>}
          {pendingWalkIn && (
            <Button size="sm" onClick={() => void handle(pendingWalkIn, true)}>
              Add as walk-in
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
