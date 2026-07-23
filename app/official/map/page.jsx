'use client'
import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ArrowLeft, Map as MapIcon, AlertTriangle, Loader2, Filter, X, ChevronDown, Shield } from 'lucide-react'
import dynamic from 'next/dynamic'
import toast from 'react-hot-toast'

const IncidentMap = dynamic(() => import('@/components/IncidentMap'), {
  ssr: false,
  loading: () => (
    <div className="rounded-3xl flex items-center justify-center" style={{ height: '70vh', background: 'white' }}>
      <div className="text-center">
        <Loader2 size={32} className="animate-spin text-purple-500 mx-auto mb-3" />
        <p className="text-sm text-gray-500">Loading map...</p>
      </div>
    </div>
  ),
})

const CATEGORY_CONFIG = {
  Noise: { color: '#f97316', emoji: '🔊' },
  Theft: { color: '#ef4444', emoji: '🚨' },
  Violence: { color: '#dc2626', emoji: '⚠️' },
  Fire: { color: '#ea580c', emoji: '🔥' },
  Flood: { color: '#3b82f6', emoji: '🌊' },
  Infrastructure: { color: '#8b5cf6', emoji: '🛠️' },
  Animals: { color: '#a16207', emoji: '🐕' },
  Medical: { color: '#dc2626', emoji: '🚑' },
  Traffic: { color: '#0891b2', emoji: '🚦' },
  Vandalism: { color: '#7c3aed', emoji: '🎨' },
  Drugs: { color: '#be185d', emoji: '💊' },
  Other: { color: '#6b7280', emoji: '📝' },
}

const STATUS_FILTERS = [
  { value: 'active', label: '🔴 Active', color: '#dc2626' },
  { value: 'pending', label: 'Pending', color: '#f97316' },
  { value: 'assigned', label: 'Assigned', color: '#3b82f6' },
  { value: 'resolved', label: 'Resolved', color: '#22c55e' },
  { value: 'all', label: 'All', color: '#5B54E8' },
]

const TRAIL_WINDOW_MS = 12 * 60 * 60 * 1000 // trails show the last 12 hours
const TRAIL_MAX_POINTS = 500                // hard cap per tanod so polylines stay light
const STALE_REFETCH_MS = 3 * 60 * 1000      // hidden-tab age that triggers a refresh
const PREFS_KEY = 'map-view-prefs'          // sessionStorage: filters survive navigation

function matchesStatus(incident, statusFilter) {
  if (statusFilter === 'all') return true
  if (statusFilter === 'active') return incident.status === 'pending' || incident.status === 'assigned'
  return incident.status === statusFilter
}

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

const DOTS = Array.from({ length: 20 }, (_, i) => ({
  size: ((i * 7) % 6) + 3,
  left: (i * 17 + 13) % 100,
  top: (i * 23 + 7) % 100,
  duration: ((i * 3) % 6) + 4,
  delay: (i * 0.7) % 4,
}))

// Ambient decoration only — skipped entirely for users who prefer reduced motion.
const AnimatedDots = () => {
  const [show, setShow] = useState(false)
  useEffect(() => {
    setShow(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])
  if (!show) return null
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {DOTS.map((dot, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: `${dot.size}px`,
            height: `${dot.size}px`,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.4)',
            left: `${dot.left}%`,
            top: `${dot.top}%`,
            animation: `float ${dot.duration}s ease-in-out infinite`,
            animationDelay: `${dot.delay}s`,
            filter: 'blur(0.5px)',
          }}
        />
      ))}
    </div>
  )
}

export default function MapView() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [incidents, setIncidents] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('active') // 'active' = pending + assigned
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [barangayId, setBarangayId] = useState(null)
  const [live, setLive] = useState(false)
  const [tanodTrails, setTanodTrails] = useState({}) // { tanodId: { tanod, points: [] } }
  // Tanods are a map LAYER, not an incident filter — independently
  // toggleable so incident filters never surprise-zoom to a tanod.
  const [showTanods, setShowTanods] = useState(true)

  // Refs used by the realtime channel + visibility handler so they can
  // trigger refetches without re-subscribing on every render.
  const hadDropRef = useRef(false)      // did the channel disconnect at some point?
  const hiddenSinceRef = useRef(null)   // when the tab went to the background
  const prefsLoadedRef = useRef(false)

  // ---- Filter persistence (loaded after mount to avoid hydration mismatch) ----
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(PREFS_KEY)
      if (raw) {
        const prefs = JSON.parse(raw)
        if (STATUS_FILTERS.some(f => f.value === prefs.statusFilter)) setStatusFilter(prefs.statusFilter)
        if (prefs.categoryFilter === 'all' || CATEGORY_CONFIG[prefs.categoryFilter]) setCategoryFilter(prefs.categoryFilter)
        if (typeof prefs.showTanods === 'boolean') setShowTanods(prefs.showTanods)
      }
    } catch { /* ignore corrupt prefs */ }
    prefsLoadedRef.current = true
  }, [])

  useEffect(() => {
    if (!prefsLoadedRef.current) return
    try {
      sessionStorage.setItem(PREFS_KEY, JSON.stringify({ statusFilter, categoryFilter, showTanods }))
    } catch { /* storage full/blocked — non-critical */ }
  }, [statusFilter, categoryFilter, showTanods])

  // ---- Data fetching (extracted so realtime reconnects can reuse it) ----
  const fetchIncidents = useCallback(async (bid) => {
    const { data, error } = await supabase
      .from('incidents')
      .select('*, profiles!incidents_reported_by_fkey(full_name)')
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

        const { data: prof } = await supabase
          .from('profiles')
          .select('barangay_id, role')
          .eq('id', user.id)
          .single()

        if (cancelled) return
        if (prof?.role !== 'official' || !prof?.barangay_id) {
          router.push('/login')
          return
        }
        setBarangayId(prof.barangay_id)

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
            .select('*, profiles!incidents_reported_by_fkey(full_name)')
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

  // Escape closes the category panel
  useEffect(() => {
    if (!categoriesOpen) return
    function onKey(e) {
      if (e.key === 'Escape') setCategoriesOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [categoriesOpen])

  // Per-category counts under the current status filter (mappable incidents only),
  // computed once instead of re-filtering the whole array per category chip
  const categoryCounts = useMemo(() => {
    const counts = {}
    incidents.forEach(i => {
      if (!i.latitude || !i.longitude) return
      if (!matchesStatus(i, statusFilter)) return
      const cat = i.category || 'Other'
      counts[cat] = (counts[cat] || 0) + 1
    })
    return counts
  }, [incidents, statusFilter])

  // Status chip counts (mappable incidents) so officials see distribution at a glance
  const statusCounts = useMemo(() => {
    const mappable = incidents.filter(i => i.latitude && i.longitude)
    return {
      all: mappable.length,
      active: mappable.filter(i => i.status === 'pending' || i.status === 'assigned').length,
      pending: mappable.filter(i => i.status === 'pending').length,
      assigned: mappable.filter(i => i.status === 'assigned').length,
      resolved: mappable.filter(i => i.status === 'resolved').length,
    }
  }, [incidents])

  const filteredIncidents = useMemo(
    () => incidents.filter(inc =>
      matchesStatus(inc, statusFilter) &&
      (categoryFilter === 'all' || inc.category === categoryFilter)
    ),
    [incidents, statusFilter, categoryFilter]
  )

  const incidentsWithCoords = useMemo(
    () => filteredIncidents.filter(i => i.latitude && i.longitude),
    [filteredIncidents]
  )
  const incidentsWithoutCoords = useMemo(
    () => filteredIncidents.filter(i => !i.latitude || !i.longitude),
    [filteredIncidents]
  )

  const onDutyTanodCount = Object.keys(tanodTrails).length
  const visibleTanodCount = showTanods ? onDutyTanodCount : 0

  // If the selected category has no matches under the new status filter,
  // its chip would vanish while the filter silently stays applied — reset it
  useEffect(() => {
    if (categoryFilter !== 'all' && !categoryCounts[categoryFilter]) {
      setCategoryFilter('all')
    }
  }, [categoryCounts, categoryFilter])

  const filtersActive = statusFilter !== 'active' || categoryFilter !== 'all'
  const activeCategoryConf = categoryFilter !== 'all' ? CATEGORY_CONFIG[categoryFilter] : null

  function clearFilters() {
    setStatusFilter('active')
    setCategoryFilter('all')
    setCategoriesOpen(false)
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-brand">
      <AnimatedDots />
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div
          className="absolute top-20 right-20 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'white', filter: 'blur(80px)', animation: 'float 8s ease-in-out infinite' }}
        />
        <div
          className="absolute bottom-20 left-20 w-72 h-72 rounded-full opacity-10"
          style={{ background: 'white', filter: 'blur(60px)', animation: 'floatReverse 10s ease-in-out infinite' }}
        />
      </div>

      <header
        className="bg-white relative z-10 px-4 sm:px-6 py-4 flex items-center gap-3"
        style={{ boxShadow: '0 2px 12px rgba(91,84,232,0.08)', borderBottom: '1px solid #f0effe' }}
      >
        <button
          onClick={() => router.back()}
          aria-label="Go back"
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-gray-100 flex-shrink-0"
        >
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)' }}
          >
            <MapIcon size={16} className="text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-gray-800 truncate">Incident Map</h1>
            <p className="text-xs text-gray-400 truncate">Incidents & on-duty tanods across your barangay</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full flex-shrink-0" style={{ background: '#f0effe' }}>
          <div
            className={`w-1.5 h-1.5 rounded-full ${live ? 'animate-pulse' : ''}`}
            style={{ background: live ? '#22c55e' : '#9ca3af' }}
            title={live ? 'Live — updates automatically' : 'Reconnecting...'}
          />
          <span className="text-xs font-bold" style={{ color: '#5B54E8' }}>
            {incidentsWithCoords.length} incidents · {visibleTanodCount} tanod{visibleTanodCount !== 1 ? 's' : ''}{live ? ' · Live' : ''}
          </span>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 py-6 space-y-4">

        {/* Controls: one compact card, two clearly separated concerns —
            INCIDENT FILTERS (left) and the TANOD LAYER toggle (right). */}
        <div className="white-card p-4 space-y-3">

          {/* Row 1: incident status segmented control + tanod layer switch */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 mr-1">
              <Filter size={13} style={{ color: '#5B54E8' }} />
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#5B54E8' }}>Incidents</p>
            </div>

            <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Filter incidents by status">
              {STATUS_FILTERS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  aria-pressed={statusFilter === f.value}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all"
                  style={{
                    background: statusFilter === f.value ? f.color : '#fafaff',
                    color: statusFilter === f.value ? 'white' : '#6b7280',
                    border: statusFilter === f.value ? `1px solid ${f.color}` : '1px solid #f0effe',
                  }}
                >
                  {f.label} <span style={{ opacity: 0.75 }}>{statusCounts[f.value]}</span>
                </button>
              ))}
            </div>

            {/* Category dropdown-style toggle: collapsed by default so the
                card stays small; shows the active pick when one is set */}
            <button
              onClick={() => setCategoriesOpen(o => !o)}
              aria-expanded={categoriesOpen}
              aria-controls="category-panel"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all"
              style={{
                background: activeCategoryConf ? activeCategoryConf.color : '#fafaff',
                color: activeCategoryConf ? 'white' : '#6b7280',
                border: activeCategoryConf ? `1px solid ${activeCategoryConf.color}` : '1px solid #f0effe',
              }}
            >
              {activeCategoryConf
                ? <><span aria-hidden="true">{activeCategoryConf.emoji}</span> {categoryFilter}</>
                : 'Category'}
              <ChevronDown size={12} className={`transition-transform ${categoriesOpen ? 'rotate-180' : ''}`} />
            </button>

            {filtersActive && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-colors hover:bg-gray-100"
                style={{ color: '#6b7280', border: '1px solid #e5e7eb' }}
              >
                <X size={10} /> Reset
              </button>
            )}

            {/* Divider pushes the tanod layer control to the right edge —
                visually its own concern, not part of the incident filters */}
            <div className="flex items-center gap-2 ml-auto pl-3"
              style={{ borderLeft: '1px solid #f0effe' }}>
              <Shield size={13} className={showTanods && onDutyTanodCount > 0 ? 'text-emerald-500' : 'text-gray-300'} />
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 leading-tight">Tanods on map</p>
                <p className="text-[10px] text-gray-400 leading-tight">{onDutyTanodCount} on duty</p>
              </div>
              <button
                onClick={() => setShowTanods(s => !s)}
                role="switch"
                aria-checked={showTanods}
                aria-label="Show on-duty tanods on the map"
                className="w-9 h-5 rounded-full flex items-center transition-all flex-shrink-0 px-0.5"
                style={{
                  background: showTanods ? '#22c55e' : '#d1d5db',
                  justifyContent: showTanods ? 'flex-end' : 'flex-start',
                }}
              >
                <span className="w-4 h-4 rounded-full bg-white block"
                  style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
              </button>
            </div>
          </div>

          {/* Row 2 (collapsible): category chips */}
          {categoriesOpen && (
            <div id="category-panel" className="flex gap-1.5 flex-wrap pt-3 fade-up"
              style={{ borderTop: '1px solid #f7f6ff' }}
              role="group" aria-label="Filter incidents by category">
              <button
                onClick={() => { setCategoryFilter('all') }}
                aria-pressed={categoryFilter === 'all'}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={{
                  background: categoryFilter === 'all' ? '#5B54E8' : '#fafaff',
                  color: categoryFilter === 'all' ? 'white' : '#6b7280',
                  border: categoryFilter === 'all' ? '1px solid #5B54E8' : '1px solid #f0effe',
                }}
              >
                All Categories
              </button>
              {Object.entries(CATEGORY_CONFIG).map(([cat, conf]) => {
                const count = categoryCounts[cat] || 0
                // Hide zero-count chips, but never hide the currently selected one
                if (count === 0 && categoryFilter !== cat) return null
                return (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(prev => (prev === cat ? 'all' : cat))}
                    aria-pressed={categoryFilter === cat}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                    style={{
                      background: categoryFilter === cat ? conf.color : '#fafaff',
                      color: categoryFilter === cat ? 'white' : conf.color,
                      border: categoryFilter === cat ? `1px solid ${conf.color}` : `1px solid ${conf.color}20`,
                    }}
                  >
                    <span aria-hidden="true">{conf.emoji}</span> {cat} ({count})
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Map */}
        {loading ? (
          <div className="rounded-3xl flex items-center justify-center" style={{ height: '70vh', background: 'white' }}>
            <div className="text-center">
              <Loader2 size={32} className="animate-spin text-purple-500 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Loading incidents...</p>
            </div>
          </div>
        ) : incidentsWithCoords.length === 0 && visibleTanodCount === 0 ? (
          <div className="white-card p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-3xl flex items-center justify-center" style={{ background: '#f0effe' }}>
              <MapIcon size={28} style={{ color: '#5B54E8', opacity: 0.5 }} />
            </div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">Nothing on the map</h2>
            <p className="text-gray-500 text-sm max-w-md mx-auto">
              {incidents.length === 0
                ? 'No incidents reported yet.'
                : filtersActive
                ? 'No incidents with location coordinates match your filters.'
                : 'No incidents with location coordinates. Encourage residents to pin their locations when reporting!'}
              {!showTanods && onDutyTanodCount > 0 && ` ${onDutyTanodCount} tanod${onDutyTanodCount === 1 ? ' is' : 's are'} on duty — turn the tanod layer on to see them.`}
            </p>
            {filtersActive && incidents.length > 0 && (
              <button
                onClick={clearFilters}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105"
                style={{ background: '#f0effe', color: '#5B54E8', border: '1px solid #e8e3ff' }}
              >
                <X size={12} /> Reset filters
              </button>
            )}
          </div>
        ) : (
          <IncidentMap incidents={incidentsWithCoords} tanodTrails={showTanods ? tanodTrails : {}} />
        )}

        {/* Incidents without coords */}
        {incidentsWithoutCoords.length > 0 && !loading && (
          <div className="white-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={14} className="text-amber-500" />
              <p className="text-xs font-bold uppercase tracking-wider text-amber-700">
                {incidentsWithoutCoords.length} incident{incidentsWithoutCoords.length !== 1 ? 's' : ''} without coordinates
              </p>
            </div>
            <p className="text-xs text-gray-400 mb-3">
              These match your filters but can't be shown on the map — they were reported without a pinned location:
            </p>
            <div className="space-y-2">
              {incidentsWithoutCoords.slice(0, 5).map(inc => {
                const cat = CATEGORY_CONFIG[inc.category] || CATEGORY_CONFIG.Other
                return (
                  <div
                    key={inc.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl"
                    style={{ background: '#fafaff', border: '1px solid #f0effe' }}
                  >
                    <span className="text-base" aria-hidden="true">{cat.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-700 truncate">{inc.title}</p>
                      <p className="text-[10px] text-gray-400 truncate">📍 {inc.location}</p>
                    </div>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0 ${
                        inc.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                        inc.status === 'assigned' ? 'bg-blue-100 text-blue-700' :
                        'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {inc.status}
                    </span>
                  </div>
                )
              })}
              {incidentsWithoutCoords.length > 5 && (
                <p className="text-[10px] text-gray-400 text-center pt-2">
                  +{incidentsWithoutCoords.length - 5} more
                </p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}