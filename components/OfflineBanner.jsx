'use client'
import { useEffect, useState, useCallback } from 'react'
import { WifiOff, RefreshCw, Check } from 'lucide-react'
import { useOnline } from '@/lib/useOnline'
import { pending, describe } from '@/lib/offline/outbox'
import { onOutboxChange, drainOutbox } from '@/lib/offline/sync'

/**
 * The app used to say nothing at all about being offline — a dot in the
 * sidebar that nobody sees. A tanod tapping a button with no signal got a
 * generic error and lost the action.
 *
 * This says both halves of the truth: that there is no connection, and
 * that what they did is being held rather than dropped.
 */
export default function OfflineBanner() {
  const online = useOnline()
  const [queued, setQueued] = useState([])
  const [syncing, setSyncing] = useState(false)
  const [justSent, setJustSent] = useState(false)

  const refresh = useCallback(async () => {
    setQueued(await pending())
  }, [])

  // onOutboxChange reads once on subscribe, so this is the only effect
  // needed and setState happens in its callback rather than in the body.
  useEffect(() => onOutboxChange(refresh), [refresh])

  // Coming back online is the moment to try, without being asked.
  useEffect(() => {
    if (!online) return
    let cancelled = false
    ;(async () => {
      const before = await pending()
      if (before.length === 0 || cancelled) return
      setSyncing(true)
      const result = await drainOutbox()
      if (cancelled) return
      setSyncing(false)
      if (result?.sent > 0) {
        setJustSent(true)
        setTimeout(() => setJustSent(false), 4000)
      }
    })()
    return () => { cancelled = true }
  }, [online])

  async function retry() {
    setSyncing(true)
    await drainOutbox()
    setSyncing(false)
  }

  const waiting = describe(queued)
  if (online && !waiting && !justSent) return null

  const tone = !online
    ? { bg: '#fffbeb', border: '#fde68a', ink: '#92400e' }
    : justSent && !waiting
      ? { bg: '#f0fdf4', border: '#dcfce7', ink: '#166534' }
      : { bg: '#eff6ff', border: '#dbeafe', ink: '#1d4ed8' }

  return (
    <div role="status" aria-live="polite"
      className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[90] w-[calc(100%-24px)] max-w-md
        rounded-2xl px-4 py-2.5 flex items-center gap-3"
      style={{ background: tone.bg, border: `1px solid ${tone.border}`, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
      {!online
        ? <WifiOff size={15} style={{ color: tone.ink }} className="flex-shrink-0" aria-hidden="true" />
        : justSent && !waiting
          ? <Check size={15} style={{ color: tone.ink }} className="flex-shrink-0" aria-hidden="true" />
          : <RefreshCw size={15} style={{ color: tone.ink }}
              className={`flex-shrink-0 ${syncing ? 'animate-spin' : ''}`} aria-hidden="true" />}

      <p className="flex-1 min-w-0 text-[12.5px] font-semibold leading-snug" style={{ color: tone.ink }}>
        {!online && waiting && <>No connection — {waiting} will be sent when you are back.</>}
        {!online && !waiting && <>No connection. You can still see what was already loaded.</>}
        {online && waiting && <>{syncing ? 'Sending' : 'Waiting to send'} {waiting}…</>}
        {online && !waiting && justSent && <>Everything you did offline has been sent.</>}
      </p>

      {online && waiting && !syncing && (
        <button onClick={retry}
          className="text-[11.5px] font-bold underline underline-offset-2 flex-shrink-0"
          style={{ color: tone.ink }}>
          Retry now
        </button>
      )}
    </div>
  )
}
