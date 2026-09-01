'use client'
import toast from 'react-hot-toast'
import { X } from 'lucide-react'

/**
 * The notification system.
 *
 * Two problems prompted this. Nine toasts opened their message with an emoji
 * on top of the icon react-hot-toast already draws, so the same event was
 * marked twice — and one of them was toast.success('🚨 New assignment'), a
 * siren delivered in a green success box. Severity was being carried by
 * whichever emoji the author happened to type, which meant it was not being
 * carried at all.
 *
 * Here severity is a parameter. notify.critical() cannot come out green,
 * because nothing about the colour is written at the call site.
 *
 * TWO DENSITIES, ONE FAMILY
 *
 * A short confirmation ("Saved", "Copied") does not need a card, and the
 * plain toast.success / toast.error calls elsewhere in the app still render
 * through react-hot-toast's own compact style — restyled in app/layout.tsx
 * to share this component's rail, radius and shadow so the two read as one
 * system at different densities. Reach for notify() when the notification
 * has a title AND a detail, or an action, or a severity worth colouring.
 *
 * DURATION
 *
 * The old default was 3 seconds for everything, which is fine for "Saved",
 * too fast to read two lines, and far too fast to click a button. Each
 * severity now gets its own, a toast carrying an action gets longer still,
 * and a critical one does not leave until it is dismissed — an unattended
 * emergency alert should not be able to expire quietly.
 */

const SEVERITY = {
  critical: { rail: '#dc2626', tint: '#fef2f2', ink: '#b91c1c', duration: Infinity, role: 'alert' },
  warn:     { rail: '#f97316', tint: '#fff7ed', ink: '#c2410c', duration: 6000,     role: 'status' },
  success:  { rail: '#16a34a', tint: '#f0fdf4', ink: '#15803d', duration: 4000,     role: 'status' },
  info:     { rail: '#5B54E8', tint: '#f0effe', ink: '#4f46e5', duration: 5000,     role: 'status' },
}

// Long enough that an action is actually clickable rather than decorative.
const ACTION_DURATION = 9000

function ToastCard({ t, severity, kind, title, body, action, secondaryLabel }) {
  const s = SEVERITY[severity] || SEVERITY.info
  const showMeter = Number.isFinite(t.duration)

  function dismiss() {
    toast.dismiss(t.id)
  }

  function runAction() {
    // Dismiss first: the action usually navigates, and a toast left behind
    // on the destination reads as a second, stale notification.
    toast.dismiss(t.id)
    action?.onClick?.()
  }

  return (
    <div
      role={s.role}
      aria-live={severity === 'critical' ? 'assertive' : 'polite'}
      className={`bh-toast ${t.visible ? 'bh-toast-in' : 'bh-toast-out'}`}
    >
      <span className="bh-toast-rail" style={{ background: s.rail }} aria-hidden="true" />

      <div className="bh-toast-main">
        <div className="bh-toast-body">
          <div className="bh-toast-text">
            {kind && (
              <p className="bh-toast-kind" style={{ color: s.ink }}>{kind}</p>
            )}
            <p className="bh-toast-title">{title}</p>
            {body && <p className="bh-toast-detail">{body}</p>}

            {action && (
              <div className="bh-toast-actions">
                <button type="button" onClick={runAction}
                  className="bh-toast-btn" style={{ background: s.rail }}>
                  {action.label}
                </button>
                <button type="button" onClick={dismiss} className="bh-toast-btn-ghost">
                  {secondaryLabel || 'Later'}
                </button>
              </div>
            )}
          </div>

          <button type="button" onClick={dismiss} aria-label="Dismiss notification"
            className="bh-toast-close">
            <X size={13} />
          </button>
        </div>

        {/* A toast about to disappear should look like it. Hidden when the
            toast never expires on its own. */}
        {showMeter && (
          <div className="bh-toast-meter" aria-hidden="true">
            <i style={{ background: s.rail, animationDuration: `${t.duration}ms` }} />
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * @param {object} o
 * @param {'critical'|'warn'|'success'|'info'} o.severity
 * @param {string} [o.kind]   short typed label — "Critical · Fire", "Verified"
 * @param {string} o.title    what happened
 * @param {string} [o.body]   why it matters
 * @param {{label:string,onClick:Function}} [o.action]
 * @param {string} [o.id]     pass to collapse repeats of the same event
 */
function show({ severity = 'info', kind, title, body, action, secondaryLabel, id, duration }) {
  const s = SEVERITY[severity] || SEVERITY.info
  const ms = duration ?? (action && Number.isFinite(s.duration)
    ? Math.max(s.duration, ACTION_DURATION)
    : s.duration)

  return toast.custom(
    (t) => (
      <ToastCard t={t} severity={severity} kind={kind} title={title}
        body={body} action={action} secondaryLabel={secondaryLabel} />
    ),
    { duration: ms, id }
  )
}

export const notify = {
  critical: (o) => show({ ...o, severity: 'critical' }),
  warn:     (o) => show({ ...o, severity: 'warn' }),
  success:  (o) => show({ ...o, severity: 'success' }),
  info:     (o) => show({ ...o, severity: 'info' }),
  dismiss:  (id) => toast.dismiss(id),
}

export default notify
