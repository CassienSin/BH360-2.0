'use client'
import { ChevronRight } from 'lucide-react'
import { TONE_RAIL } from '@/lib/recordState'

/**
 * The top of the resident home screen.
 *
 * The card it replaces said "Here's what's happening in your barangay" and
 * then nothing else — the biggest element on the page and the only one with
 * no information in it. This one says what is actually happening, and puts
 * the single most pressing thing within one tap.
 */

const PRESSING_TONE = {
  urgent: { bg: '#fef2f2', border: '#fecaca', ink: '#b91c1c', sub: '#dc2626', dot: '#dc2626' },
  watch:  { bg: '#fffbeb', border: '#fde68a', ink: '#92400e', sub: '#b45309', dot: '#f59e0b' },
  clear:  { bg: '#f0fdf4', border: '#dcfce7', ink: '#166534', sub: '#15803d', dot: '#16a34a' },
}

export function HomeSummary({ greeting, name, summary, pressing, allClearNote, onOpen }) {
  const tone = PRESSING_TONE[pressing ? pressing.tone : 'clear']
  const interactive = Boolean(pressing?.href)

  return (
    <section className="white-card p-5 sm:p-6" aria-label="Summary">
      <h2 className="text-[19px] sm:text-xl font-extrabold text-gray-800 tracking-[-0.3px]">
        {greeting}{name ? `, ${name}` : ''}
      </h2>
      <p className="text-[13.5px] text-gray-600 mt-1.5 leading-relaxed max-w-[62ch]">
        {summary}
      </p>

      {(pressing || allClearNote) && (
        <div
          {...(interactive ? {
            role: 'button', tabIndex: 0, onClick: onOpen,
            onKeyDown: e => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen?.() }
            },
          } : {})}
          className={`mt-4 px-3.5 py-3 rounded-2xl flex items-center gap-3 focus:outline-none
            focus-visible:ring-2 ${interactive ? 'cursor-pointer' : ''}`}
          style={{
            background: tone.bg, border: `1px solid ${tone.border}`,
            '--tw-ring-color': '#5B54E8',
          }}>
          <span className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: tone.dot }} aria-hidden="true" />
          <span className="flex-1 min-w-0 block">
            <span className="block text-[13px] font-bold truncate" style={{ color: tone.ink }}>
              {pressing ? pressing.title : 'All clear'}
            </span>
            <span className="block text-[11.5px] mt-0.5 truncate" style={{ color: tone.sub }}>
              {pressing ? pressing.detail : allClearNote}
            </span>
          </span>
          {interactive && (
            <ChevronRight size={15} style={{ color: tone.sub }} aria-hidden="true" />
          )}
        </div>
      )}
    </section>
  )
}

/**
 * One activity tile. The rail is the same device the incident and ticket
 * cards use, in the same colours, so the home screen and the lists read as
 * one system rather than two designs that happen to share a font.
 */
export function ActivityTile({ icon, count, label, caption, tone = 'waiting', quiet, onClick, className = '' }) {
  const rail = quiet ? '#e5e7eb' : (TONE_RAIL[tone] || TONE_RAIL.waiting)
  return (
    <button onClick={onClick}
      className={`white-card relative w-full text-left p-4 pl-[18px] cursor-pointer
        focus:outline-none focus-visible:ring-2 ${className}`}
      style={{ '--tw-ring-color': '#5B54E8' }}>
      <span className="absolute left-0 top-4 bottom-4 w-1 rounded-r"
        style={{ background: rail }} aria-hidden="true" />
      <span className="flex items-center justify-between gap-2">
        <span className="text-gray-400" aria-hidden="true">{icon}</span>
      </span>
      <span className="block text-[26px] font-extrabold leading-none mt-2.5 tabular-nums"
        style={{ color: quiet ? '#9ca3af' : rail }}>
        {count}
      </span>
      <span className="block text-[12.5px] font-semibold text-gray-700 mt-1">{label}</span>
      {caption && (
        <span className="block text-[11px] mt-0.5" style={{ color: '#9ca3af' }}>{caption}</span>
      )}
    </button>
  )
}
