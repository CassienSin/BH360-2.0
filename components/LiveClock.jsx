'use client'
import { Clock } from 'lucide-react'
import { useClock } from '@/lib/useClock'

/**
 * Hours and minutes, ticking. Its own component so the once-a-second
 * update re-renders only this, not the header or admin panel around it.
 * Renders nothing on the server, so server and browser markup agree.
 *
 * variant="inline": just the time, in the surrounding text style (the
 * band's context line). "chip" (default): a small pill with a clock icon.
 */
export default function LiveClock({ variant = 'chip' }) {
  const now = useClock()
  if (now == null) return null
  const time = new Date(now).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true })
  if (variant === 'inline') return <time dateTime={new Date(now).toISOString()}>{time}</time>
  return (
    <div className="hidden lg:flex items-center gap-2 px-3 py-2 rounded-[10px] bg-[var(--onband)] text-white">
      <Clock size={12} aria-hidden="true" />
      <span className="text-xs font-bold tabular-nums">{time}</span>
    </div>
  )
}
