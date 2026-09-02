'use client'
import { useEffect, useState } from 'react'
import { WifiOff, RefreshCw } from 'lucide-react'
import { useOnline } from '@/lib/useOnline'
import { pending, describe } from '@/lib/offline/outbox'

/**
 * Where the service worker sends a navigation it cannot serve.
 *
 * It used to fall back to '/', which is the landing page — so losing signal
 * mid-session dropped a tanod onto a marketing screen with no explanation.
 */
export default function Offline() {
  const online = useOnline()
  const [waiting, setWaiting] = useState(null)

  useEffect(() => { pending().then(items => setWaiting(describe(items))) }, [])

  return (
    <main className="min-h-dvh bg-brand flex items-center justify-center p-6">
      <div className="white-card p-7 max-w-md w-full text-center">
        <div className="w-14 h-14 rounded-3xl mx-auto mb-4 grid place-items-center"
          style={{ background: '#fffbeb' }}>
          <WifiOff size={26} style={{ color: '#b45309' }} aria-hidden="true" />
        </div>

        <h1 className="text-lg font-extrabold text-gray-800">
          {online ? 'This page is not saved for offline' : 'No connection'}
        </h1>
        <p className="text-[13.5px] text-gray-600 mt-2 leading-relaxed">
          {online
            ? 'You are back online — reload to carry on.'
            : 'BarangayHub keeps working with what it already has. Pages you opened before are still here.'}
        </p>

        {waiting && (
          <p className="text-[12.5px] mt-3 px-3 py-2.5 rounded-xl leading-relaxed"
            style={{ background: '#eff6ff', color: '#1d4ed8' }}>
            {waiting.charAt(0).toUpperCase() + waiting.slice(1)} is being held and will be sent
            the next time you open the app with a connection.
          </p>
        )}

        <button onClick={() => window.location.reload()}
          className="mt-5 w-full py-3 rounded-2xl text-sm font-bold text-white
            flex items-center justify-center gap-2 transition-transform active:scale-95"
          style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)' }}>
          <RefreshCw size={15} /> Try again
        </button>

        <p className="text-[11px] mt-3" style={{ color: '#9ca3af' }}>
          In a real emergency, call the barangay directly rather than waiting for a signal.
        </p>
      </div>
    </main>
  )
}
