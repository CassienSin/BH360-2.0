'use client'
import { useEffect, useRef, useState } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { timeAgo } from '@/lib/timeAgo'
import { typeMeta } from '@/lib/notificationTypes'

/**
 * The bell and its list, over a notification center from
 * lib/useNotifications (rows the database writes for this person).
 *
 * Opening an item marks every row it stands for read (a group of repeats
 * is one item) and goes to its link. "Mark all read" clears everything,
 * including rows older than the 50 loaded.
 *
 * `sizeClass` sizes the button to match the header it sits in (44px on
 * touch-sized layouts, 36px from lg in the dashboard header).
 */
export default function NotificationBell({ center, sizeClass = 'w-11 h-11 lg:w-9 lg:h-9' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const items = center?.items || []
  const unread = center?.unread || 0

  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
        className={`relative ${sizeClass} rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-600 transition-colors`}>
        <Bell size={16} />
        {unread > 0 && (
          <>
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 animate-ping" />
          </>
        )}
      </button>

      {open && (
        <div className="fixed sm:absolute right-3 sm:right-0 top-[calc(76px+env(safe-area-inset-top,0px))] sm:top-auto sm:mt-2 w-[calc(100vw-1.5rem)] sm:w-80 sm:max-w-none rounded-2xl overflow-hidden fade-up z-50"
          style={{ background: 'white', boxShadow: '0 16px 48px rgba(91,84,232,0.2)', border: '1px solid var(--brand-border)' }}>

          <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100"
            style={{ background: 'var(--app-surface)' }}>
            <div>
              <h3 className="text-sm font-bold text-gray-800">Notifications</h3>
              <p className="text-xs text-gray-500" aria-live="polite">
                {unread > 0
                  ? `${unread} unread ${unread === 1 ? 'item' : 'items'}`
                  : 'All caught up'}
              </p>
            </div>
            {unread > 0 && (
              <button onClick={() => center.markAllRead()}
                className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold hover:opacity-70 transition-opacity"
                style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>
                <CheckCheck size={11} aria-hidden="true" />
                Mark all read
              </button>
            )}
          </div>

          {/* Fits a short screen (a phone held sideways is ~390px tall). */}
          <div className="max-h-[min(20rem,calc(100dvh-11rem))] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <div className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center mb-3"
                  style={{ background: '#f0fdf4' }}>
                  <Bell size={20} className="text-emerald-500" />
                </div>
                <p className="text-sm font-semibold text-gray-700">All caught up!</p>
                <p className="text-xs text-gray-500 mt-0.5">No notifications right now</p>
              </div>
            ) : (
              items.map((item) => {
                const meta = typeMeta(item.latest.type)
                const read = !item.unread
                return (
                  <button
                    key={item.key}
                    onClick={() => {
                      setOpen(false)
                      center.openItem(item)
                    }}
                    className={`w-full px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0 text-left ${read ? 'opacity-60' : ''}`}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base"
                      style={{ background: meta.color }} aria-hidden="true">
                      {meta.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${read ? 'font-normal text-gray-500' : 'font-semibold text-gray-800'}`}>
                        {item.title}
                      </p>
                      {item.subtitle && <p className="text-xs text-gray-500 mt-0.5 truncate">{item.subtitle}</p>}
                      <p className="text-xs text-gray-500 mt-1">{timeAgo(item.latest.created_at)}</p>
                    </div>
                    {!read && (
                      <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                        style={{ background: 'var(--brand)' }}>
                        <span className="sr-only">Unread</span>
                      </span>
                    )}
                  </button>
                )
              })
            )}
          </div>

          {items.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-100" style={{ background: 'var(--app-surface)' }}>
              <p className="text-xs text-gray-500 text-center">Tap a notification to open it</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
