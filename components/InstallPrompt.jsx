'use client'
import { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'
import Image from 'next/image'

// localStorage throws in some private modes and embedded webviews —
// an install banner must never crash the app.
function storageGet(key) {
  try { return localStorage.getItem(key) } catch { return null }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, value) } catch { /* ignore */ }
}

// iPadOS 13+ reports itself as "Macintosh", so the old
// /iPad|iPhone|iPod/ test silently missed every modern iPad.
function detectIOS() {
  const ua = navigator.userAgent
  const classic = /iPad|iPhone|iPod/.test(ua) && !window.MSStream
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return classic || iPadOS
}

// Facebook / Messenger / Instagram etc. open links in their own webview,
// which can't install PWAs at all. This is extremely common in the PH —
// likely the main reason it "doesn't work on some devices". In these
// browsers the user must first open the site in a real browser.
function detectInAppBrowser() {
  const ua = navigator.userAgent
  return /FBAN|FBAV|FB_IAB|Instagram|Messenger|Line\/|Twitter|TikTok|Snapchat/i.test(ua)
}

// display-mode works on modern browsers; navigator.standalone covers
// older iOS Safari, which the previous check missed.
function detectStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showBanner, setShowBanner] = useState(false)
  const [showFull, setShowFull] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isInApp, setIsInApp] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    if (detectStandalone()) {
      setIsInstalled(true)
      return
    }

    const iOS = detectIOS()
    const inApp = detectInAppBrowser()
    setIsIOS(iOS)
    setIsInApp(inApp)

    // Respect a recent dismissal
    const dismissed = storageGet('pwa-install-dismissed')
    if (dismissed) {
      const daysSince = (Date.now() - parseInt(dismissed, 10)) / (1000 * 60 * 60 * 24)
      if (daysSince < 7) return
    }

    const timeouts = []

    // Chrome / Edge / Samsung Internet fire this when installable
    const handleBeforeInstall = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      timeouts.push(setTimeout(() => setShowBanner(true), 3000))
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    // If the user installs through the browser's own UI (address-bar
    // icon, menu), hide the banner — previously it kept showing.
    const handleInstalled = () => {
      setIsInstalled(true)
      setShowBanner(false)
      setShowFull(false)
    }
    window.addEventListener('appinstalled', handleInstalled)

    // iOS and in-app browsers never fire beforeinstallprompt — show the
    // banner on a timer with the appropriate instructions instead.
    if (iOS || inApp) {
      timeouts.push(setTimeout(() => setShowBanner(true), 3000))
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleInstalled)
      // Previously these timers leaked — an unmount within 3s caused a
      // setState on an unmounted component.
      timeouts.forEach(clearTimeout)
    }
  }, [])

  // Escape closes the full modal, and the page behind it doesn't scroll
  useEffect(() => {
    if (!showFull) return
    const handleEsc = (e) => { if (e.key === 'Escape') setShowFull(false) }
    document.addEventListener('keydown', handleEsc)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [showFull])

  async function handleInstall() {
    if (!deferredPrompt) {
      setShowFull(true)
      return
    }
    try {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setShowBanner(false)
        setIsInstalled(true)
      }
    } catch (err) {
      // prompt() throws if already used or blocked — fall back to steps
      console.error('InstallPrompt:', err)
      setShowFull(true)
    } finally {
      // A deferred prompt is single-use either way
      setDeferredPrompt(null)
    }
  }

  function handleDismiss() {
    setShowBanner(false)
    storageSet('pwa-install-dismissed', String(Date.now()))
  }

  if (isInstalled || !showBanner) return null

  const primaryLabel = deferredPrompt ? 'Install Now' : 'How to Install'

  return (
    <>
      {/* Compact Banner */}
      <div className="fixed bottom-4 left-4 right-4 sm:bottom-6 sm:left-auto sm:right-6 sm:w-80 z-50 fade-up">
        <div className="rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #5B54E8, #7C75F0)',
            boxShadow: '0 16px 48px rgba(91,84,232,0.4)',
          }}>
          <div className="p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center flex-shrink-0 p-1">
              <Image src="/logo.png" alt="BH360" width={40} height={40} className="object-contain" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">Install BH360</p>
              <p className="text-xs text-white/80 mt-0.5">Get the app for faster access</p>
            </div>
            <button onClick={handleDismiss} aria-label="Dismiss install banner"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white/60 hover:bg-white/10 transition-colors flex-shrink-0">
              <X size={14} />
            </button>
          </div>
          <div className="px-4 pb-4 flex gap-2">
            <button onClick={handleInstall}
              className="flex-1 py-2 rounded-xl text-xs font-bold bg-white flex items-center justify-center gap-1.5 transition-all hover:scale-[1.02]"
              style={{ color: '#5B54E8' }}>
              <Download size={12} /> {primaryLabel}
            </button>
            <button onClick={() => setShowFull(true)}
              className="px-4 py-2 rounded-xl text-xs font-bold transition-colors"
              style={{ background: 'rgba(255,255,255,0.15)', color: 'white', backdropFilter: 'blur(10px)' }}>
              Learn More
            </button>
          </div>
        </div>
      </div>

      {/* Full Install Modal */}
      {showFull && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowFull(false)}>

          <div className="w-full max-w-md rounded-3xl overflow-hidden fade-up-1 max-h-[90vh] flex flex-col"
            role="dialog" aria-modal="true" aria-labelledby="install-modal-title"
            style={{ background: 'white', boxShadow: '0 32px 80px rgba(0,0,0,0.3)' }}
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="relative px-6 pt-6 pb-4 overflow-hidden flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)' }}>
              <div className="absolute inset-0 opacity-30"
                style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

              <button onClick={() => setShowFull(false)} aria-label="Close"
                className="absolute top-4 right-4 w-8 h-8 rounded-xl flex items-center justify-center text-white/60 hover:bg-white/10 transition-colors">
                <X size={16} />
              </button>

              <div className="relative flex items-center gap-3 mb-4">
                <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center flex-shrink-0 p-1.5"
                  style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
                  <Image src="/logo.png" alt="BH360" width={52} height={52} className="object-contain" />
                </div>
                <div>
                  <h2 id="install-modal-title" className="text-xl font-black text-white" style={{ letterSpacing: '-0.5px' }}>Install BarangayHub 360</h2>
                  <p className="text-xs text-white/80 mt-1">Get the full app experience</p>
                </div>
              </div>
            </div>

            {/* Benefits */}
            <div className="p-6 space-y-3 overflow-y-auto">
              {[
                { icon: '⚡', title: 'Lightning fast', desc: 'Opens instantly from your home screen' },
                { icon: '📱', title: 'Native app feel', desc: 'Fullscreen experience, no browser UI' },
                { icon: '🔔', title: 'Push notifications', desc: 'Never miss critical incidents' },
                { icon: '🌐', title: 'Works offline', desc: 'Access cached pages without internet' },
              ].map((benefit) => (
                <div key={benefit.title} className="flex items-start gap-3 p-3 rounded-2xl"
                  style={{ background: '#fafaff', border: '1px solid #f0effe' }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
                    style={{ background: '#f0effe' }}>
                    {benefit.icon}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800">{benefit.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{benefit.desc}</p>
                  </div>
                </div>
              ))}

              {/* Instructions — pick the right steps for the environment */}
              {isInApp ? (
                <div className="rounded-2xl p-4 mt-4"
                  style={{ background: 'linear-gradient(135deg, #fafaff, #f0effe)', border: '1px solid #e8e3ff' }}>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#5B54E8' }}>
                    ⚠️ You're in an in-app browser
                  </p>
                  <p className="text-xs text-gray-500 mb-3">
                    Apps like Messenger and Facebook open links in their own browser, which can't install apps. Open BH360 in your real browser first:
                  </p>
                  <ol className="text-sm text-gray-700 space-y-2">
                    <li className="flex gap-2">
                      <span className="font-bold" style={{ color: '#5B54E8' }}>1.</span>
                      <span>Tap the <strong>⋯</strong> menu (top right)</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-bold" style={{ color: '#5B54E8' }}>2.</span>
                      <span>Choose <strong>"Open in browser"</strong> {isIOS ? '(Safari)' : '(Chrome)'}</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-bold" style={{ color: '#5B54E8' }}>3.</span>
                      <span>Then install from there</span>
                    </li>
                  </ol>
                </div>
              ) : isIOS ? (
                <div className="rounded-2xl p-4 mt-4"
                  style={{ background: 'linear-gradient(135deg, #fafaff, #f0effe)', border: '1px solid #e8e3ff' }}>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#5B54E8' }}>
                    📱 iOS Installation Steps
                  </p>
                  <ol className="text-sm text-gray-700 space-y-2">
                    <li className="flex gap-2">
                      <span className="font-bold" style={{ color: '#5B54E8' }}>1.</span>
                      <span>Tap the <strong>Share</strong> button <span className="inline-block">⬆️</span></span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-bold" style={{ color: '#5B54E8' }}>2.</span>
                      <span>Scroll down and tap <strong>"Add to Home Screen"</strong></span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-bold" style={{ color: '#5B54E8' }}>3.</span>
                      <span>Tap <strong>"Add"</strong> in the top right</span>
                    </li>
                  </ol>
                </div>
              ) : !deferredPrompt ? (
                <div className="rounded-2xl p-4 mt-4"
                  style={{ background: 'linear-gradient(135deg, #fafaff, #f0effe)', border: '1px solid #e8e3ff' }}>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#5B54E8' }}>
                    💻 Installation Steps
                  </p>
                  <ol className="text-sm text-gray-700 space-y-2">
                    <li className="flex gap-2">
                      <span className="font-bold" style={{ color: '#5B54E8' }}>1.</span>
                      <span>Look for the <strong>Install icon</strong> in your browser's address bar</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-bold" style={{ color: '#5B54E8' }}>2.</span>
                      <span>Or open the menu (⋮) and click <strong>"Install BarangayHub 360"</strong></span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-bold" style={{ color: '#5B54E8' }}>3.</span>
                      <span>Click <strong>"Install"</strong> to confirm</span>
                    </li>
                  </ol>
                </div>
              ) : null}
            </div>

            {/* Footer button */}
            {deferredPrompt && !isIOS && !isInApp && (
              <div className="px-6 pb-6 flex-shrink-0">
                <button onClick={async () => {
                  await handleInstall()
                  setShowFull(false)
                }}
                  className="w-full py-3 rounded-2xl text-sm font-bold text-white transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 8px 32px rgba(91,84,232,0.4)' }}>
                  <Download size={14} /> Install Now
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}