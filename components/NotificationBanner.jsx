'use client'
import { useState, useEffect } from 'react'
import { Bell, X, Check, Loader2 } from 'lucide-react'
import { getPermission, requestPermission, isSupported } from '@/lib/notifications'
import { subscribeToPush, pushSupport, watchForSubscriptionChange } from '@/lib/push'
import toast from 'react-hot-toast'

const DISMISS_KEY = 'notif-banner-dismissed'

// sessionStorage can throw in some privacy modes / embedded webviews —
// a notification banner should never be able to crash the page.
function safeStorageGet(key) {
  try { return sessionStorage.getItem(key) } catch { return null }
}
function safeStorageSet(key, value) {
  try { sessionStorage.setItem(key, value) } catch { /* ignore */ }
}

export default function NotificationBanner() {
  const [mounted, setMounted] = useState(false)
  const [permission, setPermission] = useState('default')
  const [dismissed, setDismissed] = useState(false)
  const [enabling, setEnabling] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (!isSupported()) return
    const current = getPermission()
    setPermission(current)
    if (safeStorageGet(DISMISS_KEY)) setDismissed(true)

    // Someone who granted permission on an earlier visit — or on another
    // device — has no push subscription yet, because subscribing only
    // started existing now. Registering here means they do not have to
    // find a setting to turn something on they already said yes to.
    if (current === 'granted' && pushSupport().supported) {
      subscribeToPush().then(res => {
        if (!res.ok) console.warn('Background notifications unavailable:', res.error)
      })
    }
  }, [])

  // The push service can rotate a subscription without anyone doing
  // anything; sw.js tells us so we can re-register the new endpoint.
  useEffect(() => watchForSubscriptionChange(), [])

  async function handleEnable() {
    if (enabling) return
    setEnabling(true)
    try {
      const result = await requestPermission()
      setPermission(result)
      if (result === 'granted') {
        // Permission alone only covers notifications while a page is open.
        // The subscription is what makes one arrive with the app closed, so
        // the two go together — asking twice would be asking the same
        // question twice.
        const support = pushSupport()
        if (!support.supported) {
          toast.success('Notifications enabled')
          if (support.reason) toast(support.reason, { duration: 7000, icon: 'ℹ️' })
        } else {
          const push = await subscribeToPush()
          if (push.ok) {
            toast.success('Notifications on, even when the app is closed')
          } else {
            toast.success('Notifications enabled')
            console.warn('Background notifications unavailable:', push.error)
          }
        }
      } else if (result === 'denied') {
        toast.error('Notifications blocked. You can enable them in browser settings.')
      }
      // result === 'default' means they closed the prompt without choosing —
      // leave the banner up so they can try again later.
    } catch (err) {
      toast.error('Could not request notification permission')
      console.error('NotificationBanner:', err)
    } finally {
      setEnabling(false)
    }
  }

  function handleDismiss() {
    setDismissed(true)
    safeStorageSet(DISMISS_KEY, 'true')
  }

  // Render nothing until mounted (prevents hydration mismatch), or when
  // there's nothing to ask: unsupported browser, already decided, dismissed.
  const hidden = !mounted || !isSupported() || permission !== 'default' || dismissed
  if (hidden) return null

  return (
    <div className="fade-up mb-4" role="status">
      <div className="rounded-2xl p-4 flex items-center gap-3"
        style={{
          background: 'linear-gradient(135deg, #f0effe, #e8e3ff)',
          border: '1px solid #e8e3ff',
        }}>
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 4px 12px rgba(91,84,232,0.3)' }}>
          <Bell size={18} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800">Enable notifications</p>
          <p className="text-xs text-gray-500">Get alerted to critical incidents and updates — even when BarangayHub is closed.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={handleEnable} disabled={enabling}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-all hover:scale-105 flex items-center gap-1.5 disabled:opacity-60 disabled:hover:scale-100"
            style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 4px 12px rgba(91,84,232,0.3)' }}>
            {enabling ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Enable
          </button>
          <button onClick={handleDismiss} aria-label="Dismiss notification banner"
            className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-white hover:text-gray-600 transition-colors">
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}