'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { AlertTriangle, MapPin, User, Clock, Phone, Volume2, VolumeX, Scale } from 'lucide-react'
import { LEGAL_BASIS } from '@/lib/legalBasis'
import { timeAgo } from '@/lib/timeAgo'

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
   Siren via Web Audio API. Deliberately synthesized rather than an mp3:
   no asset to 404, no CDN round-trip at the exact moment it's needed.
   Two-tone rise-fall, the shape people recognize as an emergency tone.
------------------------------------------------------------------------- */
function useSiren(enabled) {
  const ctxRef = useRef(null)
  const timerRef = useRef(null)

  const blast = useCallback(() => {
    try {
      if (!ctxRef.current) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext
        if (!AudioCtx) return
        ctxRef.current = new AudioCtx()
      }
      const ctx = ctxRef.current
      // Browsers suspend audio contexts created before a user gesture
      if (ctx.state === 'suspended') ctx.resume()

      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(660, now)
      osc.frequency.linearRampToValueAtTime(880, now + 0.35)
      osc.frequency.linearRampToValueAtTime(660, now + 0.7)

      // Fade in/out so it doesn't click
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(0.28, now + 0.05)
      gain.gain.setValueAtTime(0.28, now + 0.6)
      gain.gain.linearRampToValueAtTime(0, now + 0.75)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.8)
    } catch {
      // Audio is a nice-to-have — never let it break the alert itself
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      clearInterval(timerRef.current)
      return
    }
    blast()
    timerRef.current = setInterval(blast, SIREN_INTERVAL_MS)
    return () => clearInterval(timerRef.current)
  }, [enabled, blast])
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
  try {
    if (typeof Notification === 'undefined') return
    if (Notification.permission !== 'granted') return
    const n = new Notification('🚨 CRITICAL INCIDENT', {
      body: `${incident.title}\n📍 ${incident.location || 'Location not specified'}`,
      tag: `critical-${incident.id}`,   // replaces rather than stacks duplicates
      requireInteraction: true,          // stays until dismissed
      badge: '/logo.png',
      icon: '/logo.png',
    })
    n.onclick = () => { window.focus(); n.close() }
  } catch {
    // Notification constructor throws on some mobile browsers — ignore
  }
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

  useSiren(active && !muted)
  useTitleFlash(active, '🚨 CRITICAL INCIDENT')

  // Ask for notification permission once, on mount, so it's already granted
  // by the time an emergency actually arrives
  useEffect(() => {
    if (typeof Notification === 'undefined') return
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
  }, [])

  // Fire a browser notification once per incident
  useEffect(() => {
    if (!current) return
    if (notifiedRef.current.has(current.id)) return
    notifiedRef.current.add(current.id)
    fireBrowserNotification(current)
  }, [current])

  if (!current) return null

  const basis = LEGAL_BASIS[current.category]
  const waitingMs = Date.now() - new Date(current.created_at).getTime()
  const waitingMin = Math.floor(waitingMs / 60000)

  async function acknowledge() {
    setAckBusy(true)
    try {
      await onAcknowledge?.(current)
    } finally {
      setAckBusy(false)
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
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="crit-title"
        aria-describedby="crit-desc"
      >
        <div className="crit-card w-full max-w-md rounded-3xl overflow-hidden"
          style={{ background: 'white', boxShadow: '0 32px 90px rgba(0,0,0,0.5)' }}>

          {/* Header */}
          <div className="px-6 py-5 text-center" style={{ background: 'linear-gradient(135deg, #dc2626, #991b1b)' }}>
            <div className="crit-badge w-16 h-16 mx-auto rounded-3xl flex items-center justify-center mb-3"
              style={{ background: 'rgba(255,255,255,0.2)' }}>
              <AlertTriangle size={30} className="text-white" />
            </div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-red-100">
              Critical Incident
            </p>
            <h2 id="crit-title" className="text-xl font-black text-white mt-1 leading-tight">
              Immediate response required
            </h2>
            {queue.length > 1 && (
              <p className="text-xs text-red-100 mt-2 font-bold">
                {queue.length - 1} more critical {queue.length === 2 ? 'incident' : 'incidents'} waiting
              </p>
            )}
          </div>

          {/* Incident detail */}
          <div id="crit-desc" className="px-6 py-5 space-y-3">
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

            {/* Legal basis + who actually has authority */}
            {basis?.law && (
              <div className="p-3 rounded-2xl" style={{ background: '#f0effe', border: '1px solid #e8e3ff' }}>
                <div className="flex items-start gap-2">
                  <Scale size={13} className="flex-shrink-0 mt-0.5" style={{ color: '#5B54E8' }} aria-hidden="true" />
                  <p className="text-[11px] leading-relaxed" style={{ color: '#5B54E8' }}>
                    Classified Critical under <strong>{basis.law}</strong>.
                    {basis.responseMode === 'refer_to_agency' && basis.agency && (
                      <> <strong className="block mt-1 text-orange-700">
                        Contact {basis.agency} immediately — they have authority here.
                      </strong></>
                    )}
                    {basis.specialAction === 'offer_bpo' && (
                      <> <strong className="block mt-1">
                        The Punong Barangay may issue a Barangay Protection Order today (RA 9262 §14).
                      </strong></>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* Call the reporter — fastest way to get details the form missed */}
            {current.profiles?.phone && (
              <a href={`tel:${current.profiles.phone.replace(/[^0-9+]/g, '')}`}
                className="flex items-center justify-center gap-2 w-full h-11 rounded-2xl text-sm font-bold transition-transform active:scale-95"
                style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #dcfce7' }}>
                <Phone size={14} /> Call reporter
              </a>
            )}
          </div>

          {/* Actions */}
          <div className="px-6 pb-5 space-y-2">
            <button onClick={acknowledge} disabled={ackBusy}
              className="w-full h-13 py-3.5 rounded-2xl text-sm font-black text-white transition-transform active:scale-95 disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #dc2626, #991b1b)', boxShadow: '0 8px 28px rgba(220,38,38,0.4)' }}>
              {ackBusy ? 'Acknowledging…' : 'Acknowledge & respond'}
            </button>
            <button onClick={() => { onView?.(current); acknowledge() }} disabled={ackBusy}
              className="w-full py-3 rounded-2xl text-sm font-bold transition-transform active:scale-95 disabled:opacity-60"
              style={{ background: '#fafaff', color: '#5B54E8', border: '1px solid #e8e3ff' }}>
              View & dispatch a tanod
            </button>

            <button onClick={() => setMuted(m => !m)}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-bold text-gray-400 hover:text-gray-600 transition-colors">
              {muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
              {muted ? 'Sound off' : 'Mute alert sound'}
            </button>
            <p className="text-[10px] text-center text-gray-400 leading-relaxed">
              This alert stays until acknowledged. Your name and the time are recorded.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}