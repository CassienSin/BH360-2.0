'use client'
// components/DutyToggle.jsx — v2 with location sharing
//
// While ON DUTY: every 60s (and on tab focus) the heartbeat stamps
// last_seen_at AND records a GPS point into tanod_locations.
// While OFF DUTY: plain last_seen_at heartbeat every 2 minutes, no
// location is ever read or sent.
//
// The geolocation permission prompt fires when toggling ON — consent
// happens at the moment it becomes relevant. If permission is denied,
// duty status still works; only the map pin is missing (and the tanod
// is told so).

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { Shield, ShieldOff, MapPin } from 'lucide-react'
import toast from 'react-hot-toast'

const OFF_DUTY_BEAT_MS = 2 * 60 * 1000  // presence only
const ON_DUTY_BEAT_MS = 60 * 1000       // presence + location point

function getPosition() {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      () => resolve(null),                 // denied/unavailable — degrade gracefully
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    )
  })
}

export default function DutyToggle({ profile, onStatusChange }) {
  const supabase = useMemo(() => createClient(), [])
  const [onDuty, setOnDuty] = useState(profile?.on_duty ?? false)
  const [saving, setSaving] = useState(false)
  const [locationOk, setLocationOk] = useState(null) // null=unknown, true, false
  const onDutyRef = useRef(onDuty)
  useEffect(() => { onDutyRef.current = onDuty }, [onDuty])

  useEffect(() => {
    if (profile?.on_duty !== undefined) setOnDuty(profile.on_duty)
  }, [profile?.on_duty])

  // One combined beat: always stamps last_seen_at; adds a trail point
  // only when on duty and a position is available.
  const beat = useCallback(async () => {
    if (!profile?.id || document.visibilityState !== 'visible') return

    const updates = { last_seen_at: new Date().toISOString() }
    supabase.from('profiles').update(updates).eq('id', profile.id)
      .then(({ error }) => { if (error) console.error('heartbeat failed:', error) })

    if (!onDutyRef.current) return

    const pos = await getPosition()
    if (!pos) {
      setLocationOk(false)
      return
    }
    setLocationOk(true)
    const { error } = await supabase.from('tanod_locations').insert({
      tanod_id: profile.id,
      barangay_id: profile.barangay_id,
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy ?? null,
    })
    if (error) console.error('location insert failed:', error)
  }, [profile?.id, profile?.barangay_id, supabase])

  useEffect(() => {
    if (!profile?.id) return
    beat()
    // Interval speed depends on duty state; re-created when it changes
    const interval = setInterval(beat, onDuty ? ON_DUTY_BEAT_MS : OFF_DUTY_BEAT_MS)
    document.addEventListener('visibilitychange', beat)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', beat)
    }
  }, [profile?.id, onDuty, beat])

  async function toggleDuty() {
    if (saving || !profile?.id) return
    const next = !onDuty
    setSaving(true)

    // Going ON duty: trigger the browser permission prompt now, so the
    // consent moment is explicit and the first trail point is immediate.
    if (next) {
      const pos = await getPosition()
      setLocationOk(!!pos)
      if (!pos) {
        toast('Location unavailable — officials will see your duty status but not your position on the map.',
          { icon: '📍', duration: 6000 })
      }
    }

    setOnDuty(next) // optimistic
    const { error } = await supabase
      .from('profiles')
      .update({ on_duty: next, last_seen_at: new Date().toISOString() })
      .eq('id', profile.id)

    setSaving(false)
    if (error) {
      setOnDuty(!next)
      toast.error('Could not update your duty status. Please try again.')
      console.error('duty toggle failed:', error)
      return
    }

    if (next) {
      toast.success('🛡️ You are now ON DUTY')
      beat() // record the first trail point right away
    } else {
      setLocationOk(null)
      toast.success('You are now off duty. Rest well!')
    }
    onStatusChange?.(next)
  }

  return (
    <button
      onClick={toggleDuty}
      disabled={saving}
      role="switch"
      aria-checked={onDuty}
      aria-label={onDuty ? 'Go off duty' : 'Go on duty'}
      className="w-full sm:w-auto flex items-center gap-3 px-4 py-3 rounded-2xl transition-all disabled:opacity-60"
      style={{
        background: onDuty ? '#f0fdf4' : '#fafaff',
        border: `2px solid ${onDuty ? '#22c55e' : '#e8e3ff'}`,
        boxShadow: onDuty ? '0 0 0 4px rgba(34,197,94,0.08)' : 'none',
      }}>

      <div className="relative w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
        style={{ background: onDuty ? '#22c55e' : '#e8e3ff' }}>
        {onDuty
          ? <Shield size={16} className="text-white" />
          : <ShieldOff size={16} style={{ color: '#5B54E8' }} />}
        {onDuty && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
        )}
      </div>

      <div className="flex-1 text-left min-w-0">
        <p className="text-sm font-bold" style={{ color: onDuty ? '#15803d' : '#6b7280' }}>
          {onDuty ? 'On Duty' : 'Off Duty'}
        </p>
        <p className="text-[11px] text-gray-400 flex items-center gap-1">
          {saving ? 'Updating…'
            : onDuty
              ? (<>
                  <MapPin size={9} className={locationOk === false ? 'text-amber-500' : 'text-emerald-500'} />
                  {locationOk === false
                    ? 'Location unavailable — check permissions'
                    : 'Location shared with officials'}
                </>)
              : 'Tap to start your shift · location shared while on duty'}
        </p>
      </div>

      <div className="w-11 h-6 rounded-full flex items-center transition-all flex-shrink-0 px-0.5"
        style={{
          background: onDuty ? '#22c55e' : '#d1d5db',
          justifyContent: onDuty ? 'flex-end' : 'flex-start',
        }}>
        <div className="w-5 h-5 rounded-full bg-white transition-all"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
      </div>
    </button>
  )
}