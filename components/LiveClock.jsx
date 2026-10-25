'use client'
import { Clock } from 'lucide-react'
import { useClock } from '@/lib/useClock'

/**
 * Hours and minutes, ticking. Its own component so the once-a-second
 * update re-renders only this, not the header or admin panel around it.
 * Renders nothing on the server, so server and browser markup agree.
 */
export default function LiveClock() {
  const now = useClock()
  if (now == null) return null
  return (
    <div className="hidden lg:flex items-center gap-2 px-3 py-2 rounded-xl"
      style={{ background: '#fafaff', border: '1px solid #f0effe' }}>
      <Clock size={12} className="text-gray-400" aria-hidden="true" />
      <span className="text-xs font-bold text-gray-600">
        {new Date(now).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })}
      </span>
    </div>
  )
}
