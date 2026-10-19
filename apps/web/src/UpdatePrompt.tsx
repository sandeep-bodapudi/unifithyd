// PWA-4: tell people when a new version is ready instead of a silent half-update.
// PWA-5: Android install prompt; iPhone gets Add to Home Screen steps.
import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

type InstallEvent = Event & { prompt: () => Promise<void> }

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW()
  const [install, setInstall] = useState<InstallEvent | null>(null)
  const [iosTip, setIosTip] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const on = (e: Event) => {
      e.preventDefault()
      setInstall(e as InstallEvent)
    }
    window.addEventListener('beforeinstallprompt', on)
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone
    const ios = /iPhone|iPad/.test(navigator.userAgent)
    let seen = false
    try {
      seen = !!localStorage.getItem('unifit-ios-tip')
    } catch {
      /* ignore */
    }
    if (ios && !standalone && !seen && location.pathname.startsWith('/app')) setIosTip(true)
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('beforeinstallprompt', on)
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  useEffect(() => {
    if (offlineReady) setTimeout(() => setOfflineReady(false), 4000)
  }, [offlineReady, setOfflineReady])

  const dismissIos = () => {
    setIosTip(false)
    try {
      localStorage.setItem('unifit-ios-tip', '1')
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="pwa-bar-wrap" aria-live="polite">
      {!online && <div className="pwa-bar pwa-bar--warn">You are offline. You can still see your QR and saved classes.</div>}
      {needRefresh && (
        <div className="pwa-bar">
          A new version of Unifit is ready.
          <button onClick={() => void updateServiceWorker(true)}>Update</button>
          <button className="ghost" onClick={() => setNeedRefresh(false)}>
            Later
          </button>
        </div>
      )}
      {install && location.pathname.startsWith('/app') && (
        <div className="pwa-bar">
          Install Unifit on your phone for one-tap check-in.
          <button onClick={() => void install.prompt().then(() => setInstall(null))}>Install</button>
          <button className="ghost" onClick={() => setInstall(null)}>
            Not now
          </button>
        </div>
      )}
      {iosTip && (
        <div className="pwa-bar">
          Add Unifit to your Home Screen: tap Share, then "Add to Home Screen".
          <button className="ghost" onClick={dismissIos}>
            Got it
          </button>
        </div>
      )}
    </div>
  )
}
