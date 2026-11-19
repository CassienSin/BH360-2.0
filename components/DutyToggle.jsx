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
import { useNow } from '@/lib/useNow'
import toast from 'react-hot-toast'
import { KINDS } from '@/lib/offline/outbox'
import { enqueue } from '@/lib/offline/sync'

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
  const now = useNow()
  const [locationOk, setLocationOk] = useState(null) // null=unknown, true, false
  const onDutyRef = useRef(onDuty)
  useEffect(() => { onDutyRef.current = onDuty }, [onDuty])

  // Follow the server's value when it changes (another device toggled duty,
  // or the profile reloaded). Adjusted while rendering, not in an effect.
  const [syncedDuty, setSyncedDuty] = useState(profile?.on_duty)
  if (profile?.on_duty !== syncedDuty) {
    setSyncedDuty(profile?.on_duty)
    if (profile?.on_duty !== undefined) setOnDuty(profile.on_duty)
  }

  // One combined beat: always stamps last_seen_at; adds a trail point
  // only when on duty and a position is available.
  const profileId = profile?.id
  const barangayId = profile?.barangay_id
  const beat = useCallback(async () => {
    if (!profileId || document.visibilityState !== 'visible') return

    const updates = { last_seen_at: new Date().toISOString() }
    supabase.from('profiles').update(updates).eq('id', profileId)
      .then(({ error }) => { if (error) console.error('heartbeat failed:', error) })

    if (!onDutyRef.current) return

    const pos = await getPosition()
    if (!pos) {
      setLocationOk(false)
      return
    }
    setLocationOk(true)
    const { error } = await supabase.from('tanod_locations').insert({
      tanod_id: profileId,
      barangay_id: barangayId,
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy ?? null,
    })
    if (error) console.error('location insert failed:', error)
  }, [profileId, barangayId, supabase])

  useEffect(() => {
    if (!profile?.id) return
    // First beat right after this render commits, then on an interval whose
    // speed depends on duty state (re-created when it changes).
    const first = setTimeout(beat, 0)
    const interval = setInterval(beat, onDuty ? ON_DUTY_BEAT_MS : OFF_DUTY_BEAT_MS)
    document.addEventListener('visibilitychange', beat)
    return () => {
      clearTimeout(first)
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
      // Going on duty from a dead spot is a real case — a tanod starting a
      // shift somewhere with no bars. Hold it rather than snapping the
      // switch back and losing what they meant.
      const queued = await enqueue(KINDS.DUTY,
        { userId: profile.id, onDuty: next }, { userId: profile.id })
      if (!queued) {
        setOnDuty(!next)
        toast.error('Could not update your duty status. Please try again.')
        console.error('duty toggle failed:', error)
        return
      }
      toast(next
        ? 'No signal — you will show as on duty once you reconnect.'
        : 'No signal — you will show as off duty once you reconnect.',
        { icon: '📡', duration: 6000 })
      onStatusChange?.(next)
      return
    }

    if (next) {
      toast.success('You are now on duty')
      beat() // record the first trail point right away
    } else {
      setLocationOk(null)
      toast.success('You are now off duty')
    }
    onStatusChange?.(next)
  }

  // How long this shift has run, from the last duty change (T01).
  const since = onDuty && profile?.duty_changed_at ? now - new Date(profile.duty_changed_at).getTime() : null
  const shift = since == null || since < 60000 ? null
    : since >= 24 * 3600000
      // A shift longer than a day reads as when it started, not "595h".
      ? `on since ${new Date(profile.duty_changed_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}`
      : since >= 3600000
        ? `${Math.floor(since / 3600000)}h ${Math.floor((since % 3600000) / 60000)}m`
        : `${Math.floor(since / 60000)}m`

  // On the band (DESIGN.md §5 onband): a dark translucent row, white text,
  // the 44×26 switch green when on.
  return (
    <button
      type="button"
      onClick={toggleDuty}
      disabled={saving}
      role="switch"
      aria-checked={onDuty}
      aria-label={onDuty ? 'Go off duty' : 'Go on duty'}
      className="flex w-full items-center gap-3 rounded-[12px] bg-[var(--onband)] px-3.5 py-3 text-left text-white outline-none transition-colors hover:bg-[var(--onband-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60">
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-extrabold">{onDuty ? 'On duty' : 'Off duty'}</span>
        <span className="block truncate text-xs text-white/80">
          {saving ? 'Updating…'
            : onDuty
              ? (locationOk === false
                  ? 'Location unavailable: check permissions'
                  : `Sharing location with the barangay${shift ? ` · ${shift}` : ''}`)
              : 'Tap to start your shift. Location is shared while on duty.'}
        </span>
      </span>
      <span aria-hidden="true"
        className={`flex h-[26px] w-11 shrink-0 items-center rounded-full px-[3px] transition-colors ${onDuty ? 'justify-end bg-ok' : 'justify-start bg-white/30'}`}>
        <span className="size-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)]" />
      </span>
    </button>
  )
}
