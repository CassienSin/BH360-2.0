'use client'
import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, MapPin, User, Clock, Phone, Volume2, VolumeX, Scale } from 'lucide-react'
import { LEGAL_BASIS } from '@/lib/legalBasis'
import { timeAgo } from '@/lib/timeAgo'
import { showNotification } from '@/lib/notifications'
import {
  installAudioPrimer, primeAudio, playSiren,
  isAudioUnlocked, onAudioUnlockChange,
} from '@/lib/audioAlert'

/**
 * Blocking emergency alert for Critical incidents.
 *
 * Four attention layers, because a modal alone only works if someone is
 * already looking at the screen:
 *   1. Full-screen red overlay that cannot be dismissed by clicking away
 *   2. Repeating siren (Web Audio — no asset file needed)
 *   3. Browser notification (fires even when the tab is backgrounded)
 *   4. Flashing tab title (catches a glance at the taskbar)
 *
 * SMS remains the only layer that reaches an official who isn't at a
 * computer — see roadmap.
 *
 * Acknowledging records who saw it and when, which is also the barangay's
 * real time-to-awareness metric.
 */

const SIREN_INTERVAL_MS = 3000   // re-sound every 3s until acknowledged
const TITLE_FLASH_MS = 900

/* -------------------------------------------------------------------------
   Siren. The tone itself lives in lib/audioAlert.js, which also handles the
   browser's "no sound before a user gesture" rule — the reason this used to
   stay silent until someone pressed Mute and Unmute.

   Returns whether sound is currently possible, so the modal can offer a way
   to turn it on instead of quietly playing nothing.
------------------------------------------------------------------------- */
function useSiren(enabled) {
  const [canSound, setCanSound] = useState(isAudioUnlocked)

  // Unlock on the first interaction with the dashboard, well before any
  // emergency arrives.
  useEffect(() => installAudioPrimer(), [])
  useEffect(() => onAudioUnlockChange(setCanSound), [])

  useEffect(() => {
    if (!enabled) return
    let stopped = false
    playSiren()
    const id = setInterval(() => { if (!stopped) playSiren() }, SIREN_INTERVAL_MS)
    return () => { stopped = true; clearInterval(id) }
  }, [enabled])

  return canSound
}

/* -------------------------------------------------------------------------
   Flashing document title — the cheapest way to catch someone whose
   dashboard is open in a background tab.
------------------------------------------------------------------------- */
function useTitleFlash(active, message) {
  useEffect(() => {
    if (!active) return
    const original = document.title
    let on = false
    const id = setInterval(() => {
      document.title = on ? original : message
      on = !on
    }, TITLE_FLASH_MS)
    return () => {
      clearInterval(id)
      document.title = original
    }
  }, [active, message])
}

/* -------------------------------------------------------------------------
   Browser notification — reaches the official when the tab is backgrounded
   or the window is minimized, which the modal cannot do.
------------------------------------------------------------------------- */
function fireBrowserNotification(incident) {
  // Through showNotification rather than `new Notification()` directly:
  // Android Chrome throws "Illegal constructor" for the latter, so on the
  // phones most officials actually carry the critical notification was
  // being swallowed by a catch block. showNotification falls back to the
  // service worker, which Android does allow.
  //
  // force: true because this one is worth showing even with the tab in
  // front — an official looking at a different part of the dashboard still
  // needs to be told.
  showNotification('🚨 CRITICAL INCIDENT', {
    body: `${incident.title}\n📍 ${incident.location || 'Location not specified'}`,
    tag: `critical-${incident.id}`,   // replaces rather than stacks duplicates
    requireInteraction: true,          // stays until dismissed
    force: true,
    data: { url: `/official/incident/${incident.id}` },
  })
}

export default function CriticalAlert({
  incidents = [],
  onAcknowledge,       // async (incident) => void
  onView,              // (incident) => void — jump to the incident
}) {
  const [muted, setMuted] = useState(false)
  const [ackBusy, setAckBusy] = useState(false)
  const notifiedRef = useRef(new Set())

  // Oldest unacknowledged critical first — the one that's been waiting
  // longest is the one that needs attention most.
  const queue = incidents
    .filter(i => i.priority === 'Critical' && i.status !== 'resolved' && !i.acknowledged_at)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

  const current = queue[0] || null
  const active = Boolean(current)

  const canSound = useSiren(active && !muted)
  useTitleFlash(active, '🚨 CRITICAL INCIDENT')

  // Permission is NOT requested here. Firefox rejects requestPermission()
  // outside a user gesture and Chrome can auto-dismiss it, and a prompt
  // that gets dismissed leaves permission 'denied' for good — which then
  // hides NotificationBanner, the one surface that could have asked
  // properly. Asking is the banner's job, from a real click.

  // Fire a browser notification once per incident
  useEffect(() => {
    if (!current) return
    if (notifiedRef.current.has(current.id)) return
    notifiedRef.current.add(current.id)
    fireBrowserNotification(current)
  }, [current])

  if (!current) return null

  const multiple = queue.length > 1
  const basis = LEGAL_BASIS[current.category]
  const waitingMin = Math.floor((Date.now() - new Date(current.created_at).getTime()) / 60000)

  async function acknowledgeOne(incident) {
    setAckBusy(incident.id)
    try {
      await onAcknowledge?.(incident)
    } finally {
      setAckBusy(null)
    }
  }

  return (
    <>
      <style>{`
        @keyframes critPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.55); }
          50%      { box-shadow: 0 0 0 22px rgba(220,38,38,0); }
        }
        @keyframes critFlash {
          0%, 100% { background: rgba(127,29,29,0.94); }
          50%      { background: rgba(153,27,27,0.94); }
        }
        @keyframes critIn {
          from { opacity: 0; transform: scale(0.94) translateY(12px); }
          to   { opacity: 1; transform: none; }
        }
        .crit-overlay { animation: critFlash 1.4s ease-in-out infinite; }
        .crit-card    { animation: critIn 320ms cubic-bezier(0.22,1,0.36,1) both; }
        .crit-badge   { animation: critPulse 1.6s ease-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .crit-overlay, .crit-card, .crit-badge { animation: none; }
          .crit-overlay { background: rgba(127,29,29,0.94); }
        }
      `}</style>

      <div
        className="crit-overlay fixed inset-0 z-[100] flex items-center justify-center p-4"
        style={{ backdropFilter: 'blur(8px)' }}
        role="alertdialog" aria-modal="true" aria-labelledby="crit-title"
      >
        <div className="crit-card w-full max-w-md rounded-3xl overflow-hidden flex flex-col"
          style={{ background: 'white', boxShadow: '0 32px 90px rgba(0,0,0,0.5)', maxHeight: '90vh' }}>

          {/* Header */}
          <div className="px-6 py-5 text-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #dc2626, #991b1b)' }}>
            <div className="crit-badge w-16 h-16 mx-auto rounded-3xl flex items-center justify-center mb-3"
              style={{ background: 'rgba(255,255,255,0.2)' }}>
              <AlertTriangle size={30} className="text-white" />
            </div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-red-100">
              {multiple ? `${queue.length} Critical Incidents` : 'Critical Incident'}
            </p>
            <h2 id="crit-title" className="text-xl font-black text-white mt-1 leading-tight">
              {multiple ? 'Multiple emergencies active' : 'Immediate response required'}
            </h2>
            {multiple && (
              <p className="text-xs text-red-100 mt-2 leading-relaxed">
                Review all before dispatching — you may need to split your tanods.
              </p>
            )}
          </div>

          {/* MULTIPLE: triage list */}
          {multiple ? (
            <div className="overflow-y-auto flex-1 divide-y" style={{ borderColor: '#f7f6ff' }}>
              {queue.map((inc, i) => {
                const b = LEGAL_BASIS[inc.category]
                const mins = Math.floor((Date.now() - new Date(inc.created_at).getTime()) / 60000)
                return (
                  <div key={inc.id} className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-black text-white"
                        style={{ background: '#dc2626' }}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-black text-gray-900 leading-snug">{inc.title}</h3>
                        <p className="text-xs text-gray-600 mt-0.5 flex items-center gap-1">
                          <MapPin size={11} className="text-red-500 flex-shrink-0" />
                          <span className="truncate">{inc.location || 'No location'}</span>
                        </p>
                        <p className="text-[11px] mt-1 font-bold"
                          style={{ color: mins >= 5 ? '#dc2626' : '#9ca3af' }}>
                          {timeAgo(inc.created_at)}{mins >= 5 && ' — overdue'}
                          {b?.agency && ` · ${b.agency.split('(')[0].trim()}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2.5 pl-10">
                      <button onClick={() => acknowledgeOne(inc)} disabled={ackBusy === inc.id}
                        className="flex-1 h-9 rounded-xl text-[11px] font-black text-white transition-transform active:scale-95 disabled:opacity-50"
                        style={{ background: '#dc2626' }}>
                        {ackBusy === inc.id ? 'Saving…' : 'Acknowledge'}
                      </button>
                      <button onClick={() => { onView?.(inc); acknowledgeOne(inc) }} disabled={ackBusy === inc.id}
                        className="flex-1 h-9 rounded-xl text-[11px] font-bold transition-transform active:scale-95 disabled:opacity-50"
                        style={{ background: '#fafaff', color: '#5B54E8', border: '1px solid #e8e3ff' }}>
                        View & dispatch
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            /* SINGLE: full detail */
            <div className="px-6 py-5 space-y-3 overflow-y-auto flex-1">
              <div>
                <h3 className="text-base font-black text-gray-900 leading-snug">{current.title}</h3>
                {current.description && (
                  <p className="text-sm text-gray-600 mt-1 leading-relaxed"
                    style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {current.description}
                  </p>
                )}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2.5">
                  <MapPin size={15} className="flex-shrink-0 mt-0.5 text-red-500" aria-hidden="true" />
                  <span className="text-gray-700 font-semibold">{current.location || 'No location given'}</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <User size={15} className="flex-shrink-0 mt-0.5 text-gray-400" aria-hidden="true" />
                  <span className="text-gray-600">{current.profiles?.full_name || 'Unknown reporter'}</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <Clock size={15} className="flex-shrink-0 mt-0.5" style={{ color: waitingMin >= 5 ? '#dc2626' : '#9ca3af' }} aria-hidden="true" />
                  <span className="font-bold" style={{ color: waitingMin >= 5 ? '#dc2626' : '#6b7280' }}>
                    Reported {timeAgo(current.created_at)}
                    {waitingMin >= 5 && ' — response overdue'}
                  </span>
                </div>
              </div>

              {basis?.law && (
                <div className="p-3 rounded-2xl" style={{ background: '#f0effe', border: '1px solid #e8e3ff' }}>
                  <div className="flex items-start gap-2">
                    <Scale size={13} className="flex-shrink-0 mt-0.5" style={{ color: '#5B54E8' }} aria-hidden="true" />
                    <p className="text-[11px] leading-relaxed" style={{ color: '#5B54E8' }}>
                      Classified Critical under <strong>{basis.law}</strong>.
                      {basis.responseMode === 'refer_to_agency' && basis.agency && (
                        <strong className="block mt-1 text-orange-700">
                          Contact {basis.agency} immediately — they have authority here.
                        </strong>
                      )}
                      {basis.specialAction === 'offer_bpo' && (
                        <strong className="block mt-1">
                          The Punong Barangay may issue a Barangay Protection Order today (RA 9262 §14).
                        </strong>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {current.profiles?.phone && (
                <a href={`tel:${current.profiles.phone.replace(/[^0-9+]/g, '')}`}
                  className="flex items-center justify-center gap-2 w-full h-11 rounded-2xl text-sm font-bold transition-transform active:scale-95"
                  style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #dcfce7' }}>
                  <Phone size={14} /> Call reporter
                </a>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="px-6 py-4 flex-shrink-0" style={{ borderTop: multiple ? '1px solid #f0effe' : 'none' }}>
            {!multiple && (
              <div className="space-y-2 mb-2">
                <button onClick={() => acknowledgeOne(current)} disabled={ackBusy === current.id}
                  className="w-full py-3.5 rounded-2xl text-sm font-black text-white transition-transform active:scale-95 disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #dc2626, #991b1b)', boxShadow: '0 8px 28px rgba(220,38,38,0.4)' }}>
                  {ackBusy === current.id ? 'Acknowledging…' : 'Acknowledge & respond'}
                </button>
                <button onClick={() => { onView?.(current); acknowledgeOne(current) }} disabled={ackBusy === current.id}
                  className="w-full py-3 rounded-2xl text-sm font-bold transition-transform active:scale-95 disabled:opacity-60"
                  style={{ background: '#fafaff', color: '#5B54E8', border: '1px solid #e8e3ff' }}>
                  View &amp; dispatch a tanod
                </button>
              </div>
            )}

            {/* Sound blocked by the browser: say so and offer the gesture
                that fixes it, rather than showing a Mute button for a siren
                that was never audible. */}
            {!canSound && !muted ? (
              <button onClick={() => primeAudio()}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-black transition-transform active:scale-95"
                style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}>
                <VolumeX size={12} /> Alert sound is off — tap to turn it on
              </button>
            ) : (
              <button onClick={() => { setMuted(m => !m); primeAudio() }}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-bold text-gray-400 hover:text-gray-600 transition-colors">
                {muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
                {muted ? 'Sound off' : 'Mute alert sound'}
              </button>
            )}
            <p className="text-[10px] text-center text-gray-400 leading-relaxed">
              {multiple
                ? 'Each incident must be acknowledged separately. Your name and the time are recorded.'
                : 'This alert stays until acknowledged. Your name and the time are recorded.'}
            </p>
          </div>
        </div>
      </div>
    </>
  )
}