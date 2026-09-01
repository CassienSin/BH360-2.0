'use client'
import { ChevronRight } from 'lucide-react'
import { TONE_RAIL } from '@/lib/recordState'

/**
 * One card for every list in BarangayHub — incidents, tickets, document
 * requests, blotter cases — with its weight following whether the record is
 * still live.
 *
 *   live   full card, description, a progress tracker, and on a wide screen
 *          a meta column in the space the old layout left empty
 *   done   a single row: the journey is over, so what is left is finding it
 *
 * A resident with fourteen reports has nine finished ones. Giving those the
 * same height as the two still in progress buries the two that matter.
 */

/* Meta text is #9ca3af — about 4.6:1 on white. The old text-gray-300 was
   nearer 1.6:1, which is why the location and time had effectively
   disappeared on a phone. */
const META = '#9ca3af'

/** The one chip shape every list uses, so the four read as one system. */
export function Chip({ bg, color, dot, children }) {
  return (
    <span className="text-[11px] font-bold rounded-full px-2.5 py-1 inline-flex items-center gap-1.5 whitespace-nowrap"
      style={{ background: bg, color }}>
      {dot && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'currentColor' }} aria-hidden="true" />}
      {children}
    </span>
  )
}

/**
 * A priority that has already been dealt with is history, not urgency —
 * so once the record is settled it goes grey and says so. Everything used
 * to shout Critical, including the reports that were finished weeks ago.
 */
export function PriorityChip({ priority, config, settled }) {
  if (!priority) return null
  if (settled) return <Chip bg="#f3f4f6" color="#6b7280">was {priority}</Chip>
  const c = config?.[priority] || {}
  return <Chip bg={c.bg || '#f9fafb'} color={c.color || '#6b7280'}>{priority}</Chip>
}

export function RecordGroup({ label, count, children }) {
  if (!count) return null
  return (
    <>
      <div className="flex items-center gap-2.5 mt-2 mb-0.5 px-0.5">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-white/70">
          {label} · {count}
        </span>
        <span className="flex-1 h-px bg-white/20" aria-hidden="true" />
      </div>
      {children}
    </>
  )
}

/** The three steps, drawn only while the record is still moving. */
function Track({ steps, at }) {
  return (
    <ol className="flex items-center mt-3.5 pt-3.5 border-t" style={{ borderColor: '#f3f4f6' }}>
      {steps.map((label, i) => {
        const state = i < at ? 'done' : i === at ? 'now' : 'todo'
        const dot = state === 'done' ? '#10b981' : state === 'now' ? '#5B54E8' : '#e5e7eb'
        const text = state === 'done' ? '#047857' : state === 'now' ? '#5B54E8' : META
        return (
          <li key={label} className="contents">
            {i > 0 && (
              <span className="flex-1 h-0.5 mx-2 rounded-sm min-w-[14px]"
                style={{ background: i <= at ? '#10b981' : '#e5e7eb' }} aria-hidden="true" />
            )}
            <span className="flex items-center gap-[7px] flex-shrink-0">
              <span className="w-[9px] h-[9px] rounded-full flex-shrink-0"
                style={{
                  background: dot,
                  ...(state === 'now' ? { boxShadow: '0 0 0 3px rgba(91,84,232,0.18)' } : {}),
                }}
                aria-hidden="true" />
              <span className={`text-[10.5px] font-semibold ${state === 'now' ? '' : 'hidden sm:inline'}`}
                style={{ color: text }}>{label}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * @param {object} p
 * @param {boolean} p.live          full card when true, compact row when false
 * @param {string}  p.tone          waiting | active | done | closed | overdue
 * @param {node}    p.icon
 * @param {string}  p.iconBg
 * @param {string}  p.title
 * @param {string}  [p.description] live cards only — clamped to two lines
 * @param {node}    [p.meta]        location and the like
 * @param {node}    [p.status]      the status chip
 * @param {node}    [p.badges]      priority and other tags
 * @param {string}  [p.when]        "2 minutes ago" live, "2m" once done
 * @param {string[]}[p.steps]       three labels for the tracker
 * @param {number}  [p.at]          0, 1 or 2
 * @param {node}    [p.action]      e.g. Rate this
 * @param {node}    [p.footer]      anything extra below the body
 */
export default function RecordCard({
  live, tone = 'waiting', icon, iconBg = '#f3f4f6',
  title, description, meta, status, badges, when,
  steps, at = 0, action, footer, onClick, ariaLabel,
}) {
  const rail = (
    <span
      className="absolute left-0 rounded-r"
      style={{ top: live ? 18 : 12, bottom: live ? 18 : 12, width: 4, background: TONE_RAIL[tone] || TONE_RAIL.waiting }}
      aria-hidden="true"
    />
  )

  const shell = `white-card relative w-full text-left cursor-pointer block
    focus:outline-none focus-visible:ring-2 ${live ? 'p-5 pl-6' : 'py-3 px-[18px] pl-[22px]'}`

  // A finished card sits lower and lighter than a live one — the same
  // distinction the height already makes, carried by the shadow too.
  const shellStyle = {
    '--tw-ring-color': '#5B54E8',
    ...(live ? {} : { borderRadius: 18, boxShadow: '0 4px 18px rgba(91,84,232,0.09)' }),
  }

  const rootProps = {
    role: 'button',
    tabIndex: 0,
    onClick,
    onKeyDown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.() }
    },
    className: shell,
    style: shellStyle,
    'aria-label': ariaLabel,
  }

  if (!live) {
    return (
      <div {...rootProps}>
        {rail}
        <span className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-xl grid place-items-center flex-shrink-0"
            style={{ background: iconBg }} aria-hidden="true">{icon}</span>
          <span className="flex-1 min-w-0 block">
            <span className="block text-[13.5px] font-semibold text-gray-800 truncate">{title}</span>
            {meta && <span className="block text-xs mt-0.5 truncate" style={{ color: META }}>{meta}</span>}
          </span>
          <span className="flex items-center gap-2 flex-shrink-0">
            {action}
            <span className="hidden sm:contents">{badges}</span>
            {when && <span className="text-[11.5px] tabular-nums whitespace-nowrap" style={{ color: META }}>{when}</span>}
            <ChevronRight size={14} className="text-gray-300" aria-hidden="true" />
          </span>
        </span>
      </div>
    )
  }

  return (
    <div {...rootProps}>
      {rail}
      <span className="flex items-start gap-4">
        <span className="w-10 h-10 rounded-2xl grid place-items-center flex-shrink-0"
          style={{ background: iconBg }} aria-hidden="true">{icon}</span>

        <span className="flex-1 min-w-0 block">
          <span className="block text-[14.5px] font-semibold text-gray-800 leading-snug">{title}</span>
          {description && (
            <span className="text-[12.5px] text-gray-500 mt-1 leading-relaxed line-clamp-2">
              {description}
            </span>
          )}
          {meta && (
            <span className="flex items-center gap-1.5 flex-wrap text-xs mt-2" style={{ color: META }}>
              {meta}
              {/* The time joins the meta line only on narrow screens; wider
                  than that it belongs in the column on the right. */}
              {when && <><span className="opacity-50 sm:hidden">·</span>
                <span className="sm:hidden">{when}</span></>}
            </span>
          )}
          {/* Chips live inline below the meta on a phone, and move into the
              right-hand column once there is room for one. */}
          <span className="flex items-center gap-2 flex-wrap mt-2.5 sm:hidden">
            {status}{badges}
          </span>
          {action}
          {footer}
          {steps && <Track steps={steps} at={at} />}
        </span>

        <span className="hidden sm:flex flex-col items-end gap-2 flex-shrink-0 self-stretch
          justify-center pl-4 border-l min-w-[142px]" style={{ borderColor: '#f3f4f6' }}>
          {status}
          {badges}
          {when && <span className="text-[11.5px]" style={{ color: META }}>{when}</span>}
        </span>
      </span>
    </div>
  )
}
