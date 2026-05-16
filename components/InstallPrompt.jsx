'use client'
import { useState, useEffect } from 'react'
import { Download, X, Smartphone, Zap } from 'lucide-react'
import Image from 'next/image'

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showBanner, setShowBanner] = useState(false)
  const [showFull, setShowFull] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Check if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }

    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
    setIsIOS(iOS)

    // Check if dismissed previously
    const dismissed = localStorage.getItem('pwa-install-dismissed')
    if (dismissed) {
      const dismissedAt = parseInt(dismissed)
      const daysSince = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24)
      if (daysSince < 7) return // Don't show for 7 days after dismissal
    }

    // Listen for the install prompt event (Chrome, Edge, etc)
    const handleBeforeInstall = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      // Show banner after 3 seconds (give user time to see the app)
      setTimeout(() => setShowBanner(true), 3000)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    // For iOS - show after a delay
    if (iOS) {
      setTimeout(() => setShowBanner(true), 3000)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
    }
  }, [])

  async function handleInstall() {
    if (!deferredPrompt) {
      setShowFull(true)
      return
    }

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      setShowBanner(false)
      setIsInstalled(true)
    }
    setDeferredPrompt(null)
  }

  function handleDismiss() {
    setShowBanner(false)
    localStorage.setItem('pwa-install-dismissed', String(Date.now()))
  }

  if (isInstalled || !showBanner) return null

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
            <button onClick={handleDismiss}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white/60 hover:bg-white/10 transition-colors flex-shrink-0">
              <X size={14} />
            </button>
          </div>
          <div className="px-4 pb-4 flex gap-2">
            <button onClick={handleInstall}
              className="flex-1 py-2 rounded-xl text-xs font-bold bg-white flex items-center justify-center gap-1.5 transition-all hover:scale-[1.02]"
              style={{color: '#5B54E8'}}>
              <Download size={12} /> {isIOS ? 'How to Install' : 'Install Now'}
            </button>
            <button onClick={() => setShowFull(true)}
              className="px-4 py-2 rounded-xl text-xs font-bold transition-colors"
              style={{background: 'rgba(255,255,255,0.15)', color: 'white', backdropFilter: 'blur(10px)'}}>
              Learn More
            </button>
          </div>
        </div>
      </div>

      {/* Full Install Modal */}
      {showFull && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)'}}
          onClick={() => setShowFull(false)}>

          <div className="w-full max-w-md rounded-3xl overflow-hidden fade-up-1"
            style={{background: 'white', boxShadow: '0 32px 80px rgba(0,0,0,0.3)'}}
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="relative px-6 pt-6 pb-4 overflow-hidden"
              style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)'}}>
              <div className="absolute inset-0 opacity-30"
                style={{backgroundImage: 'radial-gradient(circle at 30% 50%, white 1px, transparent 1px)', backgroundSize: '40px 40px'}} />

              <button onClick={() => setShowFull(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-xl flex items-center justify-center text-white/60 hover:bg-white/10 transition-colors">
                <X size={16} />
              </button>

              <div className="relative flex items-center gap-3 mb-4">
                <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center flex-shrink-0 p-1.5"
                  style={{boxShadow: '0 8px 24px rgba(0,0,0,0.2)'}}>
                  <Image src="/logo.png" alt="BH360" width={52} height={52} className="object-contain" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white" style={{letterSpacing: '-0.5px'}}>Install BarangayHub 360</h2>
                  <p className="text-xs text-white/80 mt-1">Get the full app experience</p>
                </div>
              </div>
            </div>

            {/* Benefits */}
            <div className="p-6 space-y-3">
              {[
                { icon: '⚡', title: 'Lightning fast', desc: 'Opens instantly from your home screen' },
                { icon: '📱', title: 'Native app feel', desc: 'Fullscreen experience, no browser UI' },
                { icon: '🔔', title: 'Push notifications', desc: 'Never miss critical incidents' },
                { icon: '🌐', title: 'Works offline', desc: 'Access cached pages without internet' },
              ].map((benefit, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-2xl"
                  style={{background: '#fafaff', border: '1px solid #f0effe'}}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
                    style={{background: '#f0effe'}}>
                    {benefit.icon}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800">{benefit.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{benefit.desc}</p>
                  </div>
                </div>
              ))}

              {/* Instructions */}
              {isIOS ? (
                <div className="rounded-2xl p-4 mt-4"
                  style={{background: 'linear-gradient(135deg, #fafaff, #f0effe)', border: '1px solid #e8e3ff'}}>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{color: '#5B54E8'}}>
                    📱 iOS Installation Steps
                  </p>
                  <ol className="text-sm text-gray-700 space-y-2">
                    <li className="flex gap-2">
                      <span className="font-bold" style={{color: '#5B54E8'}}>1.</span>
                      Tap the <strong>Share</strong> button <span className="inline-block">⬆️</span> in Safari
                    </li>
                    <li className="flex gap-2">
                      <span className="font-bold" style={{color: '#5B54E8'}}>2.</span>
                      Scroll down and tap <strong>"Add to Home Screen"</strong>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-bold" style={{color: '#5B54E8'}}>3.</span>
                      Tap <strong>"Add"</strong> in the top right
                    </li>
                  </ol>
                </div>
              ) : !deferredPrompt ? (
                <div className="rounded-2xl p-4 mt-4"
                  style={{background: 'linear-gradient(135deg, #fafaff, #f0effe)', border: '1px solid #e8e3ff'}}>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{color: '#5B54E8'}}>
                    💻 Installation Steps
                  </p>
                  <ol className="text-sm text-gray-700 space-y-2">
                    <li className="flex gap-2">
                      <span className="font-bold" style={{color: '#5B54E8'}}>1.</span>
                      Look for the <strong>Install icon</strong> 💻 in your browser's address bar
                    </li>
                    <li className="flex gap-2">
                      <span className="font-bold" style={{color: '#5B54E8'}}>2.</span>
                      Or open the menu (⋮) and click <strong>"Install BarangayHub 360"</strong>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-bold" style={{color: '#5B54E8'}}>3.</span>
                      Click <strong>"Install"</strong> to confirm
                    </li>
                  </ol>
                </div>
              ) : null}
            </div>

            {/* Footer button */}
            {deferredPrompt && !isIOS && (
              <div className="px-6 pb-6">
                <button onClick={async () => {
                  await handleInstall()
                  setShowFull(false)
                }}
                  className="w-full py-3 rounded-2xl text-sm font-bold text-white transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
                  style={{background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 8px 32px rgba(91,84,232,0.4)'}}>
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