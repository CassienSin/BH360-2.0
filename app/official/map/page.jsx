'use client'
import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import toast from 'react-hot-toast'
import IncidentMapScreen from '@/components/IncidentMapScreen'

/**
 * Official incident map: loads the barangay's incidents and on-duty tanod
 * trails, keeps them live over Supabase realtime, and hands them to the
 * console (components/IncidentMapScreen → CommandMap). Filtering, layers
 * and dispatch UI all live in the console; this file is data only.
 */

const INCIDENT_SELECT = '*, profiles!incidents_reported_by_fkey(full_name, phone)'
const TRAIL_WINDOW_MS = 12 * 60 * 60 * 1000 // trails show the last 12 hours
const TRAIL_MAX_POINTS = 500                // hard cap per tanod so trails stay light
const STALE_REFETCH_MS = 3 * 60 * 1000      // hidden-tab age that triggers a refresh

// Drop points that fell out of the 12h window and cap the array length.
// Returns the same object reference when nothing changed so React skips the re-render.
function pruneTrails(trails) {
  const cutoff = Date.now() - TRAIL_WINDOW_MS
  let changed = false
  const next = {}
  for (const [id, entry] of Object.entries(trails)) {
    let points = entry.points
    const firstFresh = points.findIndex(p => new Date(p.recorded_at).getTime() >= cutoff)
    if (firstFresh > 0) { points = points.slice(firstFresh); changed = true }
    else if (firstFresh === -1 && points.length > 0) { points = []; changed = true }
    if (points.length > TRAIL_MAX_POINTS) { points = points.slice(-TRAIL_MAX_POINTS); changed = true }
    next[id] = points === entry.points ? entry : { ...entry, points }
  }
  return changed ? next : trails
}

export default function MapView() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [incidents, setIncidents] = useState([])
  const [loading, setLoading] = useState(true)
  const [barangayId, setBarangayId] = useState(null)
  const [live, setLive] = useState(false)
  const [tanodTrails, setTanodTrails] = useState({}) // { tanodId: { tanod, points: [] } }
  const [barangayName, setBarangayName] = useState('')

  // Refs used by the realtime channel + visibility handler so they can
  // trigger refetches without re-subscribing on every render.
  const hadDropRef = useRef(false)      // did the channel disconnect at some point?
  const hiddenSinceRef = useRef(null)   // when the tab went to the background

  // ---- Data fetching (extracted so realtime reconnects can reuse it) ----
  const fetchIncidents = useCallback(async (bid) => {
    const { data, error } = await supabase
      .from('incidents')
      .select(INCIDENT_SELECT)
      .eq('barangay_id', bid)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  }, [supabase])

  const fetchTanodTrails = useCallback(async (bid) => {
    // On-duty tanods + their trail points from the last 12 hours
    const [{ data: tanodRows }, { data: locRows }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, phone, on_duty, last_seen_at, avatar_url')
        .eq('barangay_id', bid)
        .eq('role', 'tanod')
        .eq('on_duty', true)
        .is('deactivated_at', null),
      supabase
        .from('tanod_locations')
        .select('tanod_id, latitude, longitude, accuracy, recorded_at')
        .eq('barangay_id', bid)
        .gte('recorded_at', new Date(Date.now() - TRAIL_WINDOW_MS).toISOString())
        .order('recorded_at', { ascending: true }),
    ])
    // Points from off-duty tanods are dropped automatically because they
    // were never added to the trails object — the map only ever shows
    // people currently on shift.
    const trails = {}
    for (const t of tanodRows || []) {
      trails[t.id] = { tanod: t, points: [] }
    }
    for (const p of locRows || []) {
      if (trails[p.tanod_id]) trails[p.tanod_id].points.push(p)
    }
    return pruneTrails(trails)
  }, [supabase])

  // Full refresh used after realtime gaps — silent (no loading spinner, no
  // toast on success) so the map just quietly catches up.
  const refreshAll = useCallback(async (bid) => {
    try {
      const [incidentData, trails] = await Promise.all([fetchIncidents(bid), fetchTanodTrails(bid)])
      setIncidents(incidentData)
      setTanodTrails(trails)
    } catch (err) {
      console.error('Background refresh failed:', err)
    }
  }, [fetchIncidents, fetchTanodTrails])

  // ---- Initial load ----
  useEffect(() => {
    let cancelled = false

    async function loadData() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
          router.push('/login')
          return
        }

        const { data: prof, error: profError } = await supabase
          .from('profiles')
          .select('barangay_id, role, barangays(name)')
          .eq('id', user.id)
          .single()

        if (cancelled) return
      // A failed query is not the same as being the wrong role. Sending
      // someone to the login page for a network blip signs them out of a
      // session that is perfectly valid.
        if (profError) {
          console.error('Could not load your profile:', profError)
          toast.error('Could not load the map. Please refresh.')
          setLoading(false)
          return
        }
        if (prof?.role !== 'official' || !prof?.barangay_id) {
          router.push('/login')
          return
        }
        setBarangayId(prof.barangay_id)
        setBarangayName(prof.barangays?.name || '')

        const [incidentData, trails] = await Promise.all([
          fetchIncidents(prof.barangay_id),
          fetchTanodTrails(prof.barangay_id),
        ])
        if (cancelled) return
        setIncidents(incidentData)
        setTanodTrails(trails)
      } catch (err) {
        console.error('Failed to load incidents:', err)
        if (!cancelled) toast.error('Failed to load incidents. Please refresh.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadData()

    return () => { cancelled = true }
  }, [supabase, router, fetchIncidents, fetchTanodTrails])

  // ---- Realtime: keep the map in sync while it's open ----
  useEffect(() => {
    if (!barangayId) return

    const channel = supabase.channel(`map-incidents-${barangayId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'incidents', filter: `barangay_id=eq.${barangayId}` },
        async (payload) => {
          // Realtime payloads don't include joined tables — refetch the row
          // with the reporter's name attached
          const { data, error } = await supabase
            .from('incidents')
            .select(INCIDENT_SELECT)
            .eq('id', payload.new.id)
            .single()
          if (error || !data) return
          setIncidents(prev => (prev.some(i => i.id === data.id) ? prev : [data, ...prev]))

          const isCritical = data.priority === 'Critical'
          toast(
            `${isCritical ? '🔴' : '📍'} New incident: ${data.title}`,
            { duration: isCritical ? 8000 : 4000, icon: isCritical ? '🚨' : undefined }
          )
        })
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'incidents', filter: `barangay_id=eq.${barangayId}` },
        (payload) => {
          // Merge into the existing row so the joined reporter name is preserved
          setIncidents(prev => prev.map(i => (i.id === payload.new.id ? { ...i, ...payload.new } : i)))
        })
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'incidents' },
        (payload) => {
          setIncidents(prev => prev.filter(i => i.id !== payload.old.id))
        })
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tanod_locations', filter: `barangay_id=eq.${barangayId}` },
        (payload) => {
          // Trail grows live as on-duty tanods move
          setTanodTrails(prev => {
            const entry = prev[payload.new.tanod_id]
            if (!entry) return prev // not on duty per our view — ignore
            const points = [...entry.points, payload.new]
            return {
              ...prev,
              [payload.new.tanod_id]: {
                ...entry,
                // Cap inline too — a 12h shift with 10s pings would otherwise
                // build a 4000-point polyline between prune ticks
                points: points.length > TRAIL_MAX_POINTS ? points.slice(-TRAIL_MAX_POINTS) : points,
              },
            }
          })
        })
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `barangay_id=eq.${barangayId}` },
        (payload) => {
          if (payload.new.role !== 'tanod') return
          // Off duty OR deactivated mid-shift — remove from the map immediately
          if (payload.new.on_duty === false || payload.new.deactivated_at) {
            setTanodTrails(prev => {
              if (!prev[payload.new.id]) return prev
              const next = { ...prev }
              delete next[payload.new.id]
              return next
            })
          } else {
            // Came on duty (or heartbeat update) — ensure they exist and stay fresh
            setTanodTrails(prev => ({
              ...prev,
              [payload.new.id]: {
                tanod: { ...(prev[payload.new.id]?.tanod || {}), ...payload.new },
                points: prev[payload.new.id]?.points || [],
              },
            }))
          }
        })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Reconnected after a drop → anything that happened during the gap
          // never arrived. Refetch so the map catches up.
          if (hadDropRef.current) {
            hadDropRef.current = false
            refreshAll(barangayId)
          }
          setLive(true)
        } else {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            hadDropRef.current = true
          }
          setLive(false)
        }
      })

    return () => {
      setLive(false)
      supabase.removeChannel(channel)
    }
  }, [barangayId, supabase, refreshAll])

  // ---- Tab visibility: refresh after the page has been backgrounded a while.
  // Mobile browsers freeze websockets in background tabs; the channel often
  // *looks* subscribed but missed everything. ----
  useEffect(() => {
    if (!barangayId) return
    function onVisibility() {
      if (document.visibilityState === 'hidden') {
        hiddenSinceRef.current = Date.now()
      } else if (hiddenSinceRef.current && Date.now() - hiddenSinceRef.current > STALE_REFETCH_MS) {
        hiddenSinceRef.current = null
        refreshAll(barangayId)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [barangayId, refreshAll])

  // ---- Trail pruning: every 5 minutes, drop points older than the 12h
  // window so a map left open overnight doesn't accumulate stale trails ----
  useEffect(() => {
    const id = setInterval(() => setTanodTrails(pruneTrails), 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  // Dispatch from the console. The .eq('status','pending') guard makes it
  // atomic — two officials can't double-assign the same incident.
  const handleDispatch = useCallback(async (incident, tanodId) => {
    const { data, error } = await supabase.from('incidents')
      .update({ assigned_to: tanodId, status: 'assigned', assignment_method: 'manual' })
      .eq('id', incident.id)
      .eq('status', 'pending')
      .select()
    if (error) { toast.error('Dispatch failed. Please try again.'); return }
    if (!data || data.length === 0) {
      toast.error('That incident was already assigned by someone else.')
      return
    }
    setIncidents(prev => prev.map(i =>
      i.id === incident.id ? { ...i, assigned_to: tanodId, status: 'assigned' } : i
    ))
    toast.success('Tanod dispatched')
  }, [supabase])

  return (
    <IncidentMapScreen
      loading={loading}
      barangayName={barangayName}
      live={live}
      incidents={incidents}
      tanodTrails={tanodTrails}
      onDispatch={handleDispatch}
      onOpenIncident={(inc) => router.push(`/official/incident/${inc.id}`)}
      onBack={() => router.push('/official')}
    />
  )
}
