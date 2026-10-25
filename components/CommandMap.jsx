'use client'
import { useState, useMemo, useEffect, useRef, useSyncExternalStore } from 'react'
import dynamic from 'next/dynamic'
import {
  Layers, CircleDot, History, Play, Pause, X, Search, MapPin, MapPinOff,
  Phone, Send, Navigation, ChevronDown, ChevronUp, Info,
} from 'lucide-react'
import { timeAgo, fullDate } from '@/lib/timeAgo'
import { rankResponders, formatDistance, formatEta, distanceMeters } from '@/lib/geo'
import { stateAtTime } from '@/lib/mapStats'
import { CATEGORY_CONFIG, LEGAL_BASIS } from '@/lib/legalBasis'
import { CategoryIcon } from '@/lib/categoryIcons'
import { isOverdue, overdueMs, urgency, hasCoords, RESPONSE_WINDOW_MS } from '@/lib/mapGeometry'
import { BASEMAPS } from '@/lib/mapConfig'
import { useNow } from '@/lib/useNow'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { useRoadRoutes } from '@/lib/useRoadRoutes'
import { initials } from '@/components/map/Markers'
import styles from './command-map.module.css'

const IncidentMap = dynamic(() => import('@/components/IncidentMap'), {
  ssr: false,
  loading: () => <div className={styles.mapLoading}>Loading map…</div>,
})

/**
 * Incident command console: see, decide, dispatch without leaving the map.
 *
 *   stat strip   — counts that double as one-tap filters
 *   queue        — the work list, grouped by what each incident needs next
 *   map          — situational awareness, with Layers, Measure and Replay
 *   drawer       — the selected incident and its closest responders
 *
 * On phones the queue and drawer become a bottom sheet over a full-screen
 * map. Filtering lives here, so the stat strip, queue and map always agree.
 */

export const STATUS_FILTERS = [
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'all', label: 'All' },
]

export const DEFAULT_PREFS = {
  statusFilter: 'active',
  categoryFilter: 'all',
  theme: 'light',
  basemap: 'clean',
  layers: { tanods: true, heatmap: false, coverage: false },
}

export function matchesStatus(incident, filter) {
  if (filter === 'all') return true
  if (filter === 'active') return incident.status === 'pending' || incident.status === 'assigned'
  return incident.status === filter
}

const STALE_MS = 5 * 60 * 1000
const noopSubscribe = () => () => {}
const MOBILE_FIT_PADDING = { top: 110, bottom: 320, left: 36, right: 36 }
const MOBILE_FLY_OFFSET = [0, -130] // centre the pin between the toolbar and the incident sheet
const MEASURE_RADIUS = 200
const REPLAY_MINUTES = 24 * 60
const PRIORITY_TONE = { Critical: 'tDanger', High: 'tHigh', Medium: 'tNeutral', Low: 'tNeutral' }
const STATUS_TONE = { pending: 'tWarn', assigned: 'tInfo', resolved: 'tOk' }
const STATUS_LABEL = { pending: 'Pending', assigned: 'Assigned', resolved: 'Resolved' }

function durationText(ms) {
  const m = Math.max(1, Math.round(ms / 60000))
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h} hr ${r} min` : `${h} hr`
}

const byUrgencyThenAge = (a, b) =>
  urgency(b) - urgency(a) || new Date(a.created_at) - new Date(b.created_at)

/* ------------------------------ console ------------------------------ */

export default function CommandMap({
  incidents = [],      // every incident in the barangay, with or without a pin
  tanodTrails = {},    // { tanodId: { tanod, points: [...] } } — on-duty tanods only
  onDispatch,          // (incident, tanodId) => Promise
  onOpenIncident,      // (incident) => void
  prefs = DEFAULT_PREFS,
  setPref,             // (key, value) => void — persisted by the screen
}) {
  const now = useNow()
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  // The server cannot know the screen size and renders the desktop layout.
  // The map waits for the real layout, or it would fit its first view to
  // a pane that is about to change size.
  const layoutKnown = useSyncExternalStore(noopSubscribe, () => true, () => false)
  const { statusFilter, categoryFilter, theme, basemap, layers } = { ...DEFAULT_PREFS, ...prefs }

  const [selectedId, setSelectedId] = useState(null)
  const [flyTarget, setFlyTarget] = useState(null)
  const [quick, setQuick] = useState(null)          // 'critical' | 'overdue' | null
  const [search, setSearch] = useState('')
  const [focusIds, setFocusIds] = useState(null)    // ids from a tapped group on the map
  const [layersOpen, setLayersOpen] = useState(false)
  const [measuring, setMeasuring] = useState(false)
  const [measureCenter, setMeasureCenter] = useState(null)
  const [replaying, setReplaying] = useState(false)
  const [replayOffset, setReplayOffset] = useState(0) // minutes before now
  const [playing, setPlaying] = useState(false)
  const [sheet, setSheet] = useState('peek')         // mobile: 'peek' | 'queue'
  const [showAllProgress, setShowAllProgress] = useState(false)
  const [resolvedOpen, setResolvedOpen] = useState(false)
  const [noPinOpen, setNoPinOpen] = useState(false)
  const [legendOpen, setLegendOpen] = useState(false)
  const [dispatching, setDispatching] = useState(null)

  // ---- tanods ----
  const livePositions = useMemo(() => {
    const out = []
    for (const [tanodId, { tanod, points }] of Object.entries(tanodTrails || {})) {
      const valid = (points || []).filter(hasCoords)
      if (!valid.length) continue
      const latest = valid[valid.length - 1]
      const at = new Date(latest.recorded_at).getTime()
      out.push({
        tanodId, tanod,
        latitude: latest.latitude,
        longitude: latest.longitude,
        accuracy: latest.accuracy,
        recordedAt: latest.recorded_at,
        firstAt: valid[0].recorded_at,
        stale: !Number.isFinite(at) || now - at > STALE_MS,
      })
    }
    return out
  }, [tanodTrails, now])

  const tanodById = useMemo(() => {
    const m = {}
    for (const [id, { tanod }] of Object.entries(tanodTrails || {})) m[id] = tanod
    return m
  }, [tanodTrails])

  const allTrailPoints = useMemo(
    () => Object.values(tanodTrails || {}).flatMap(t => (t.points || []).filter(hasCoords)),
    [tanodTrails]
  )

  // ---- replay ----
  const atMs = now - replayOffset * 60000
  const evalTime = replaying ? atMs : now
  const rewound = useMemo(
    () => (replaying ? stateAtTime(incidents, tanodTrails, atMs) : null),
    [replaying, incidents, tanodTrails, atMs]
  )
  const shownIncidents = rewound ? rewound.incidents : incidents
  const positions = rewound ? rewound.tanodPositions : livePositions

  const offsetRef = useRef(0)
  useEffect(() => { offsetRef.current = replayOffset })
  useEffect(() => {
    if (!playing) return undefined
    const id = setInterval(() => {
      const next = Math.max(0, offsetRef.current - 5)
      setReplayOffset(next)
      if (next === 0) setPlaying(false)
    }, 220)
    return () => clearInterval(id)
  }, [playing])

  // ---- counts (never filtered: they are what the filters choose from) ----
  const stats = useMemo(() => {
    let active = 0, critical = 0, overdue = 0
    for (const i of shownIncidents) {
      if (i.status === 'resolved') continue
      active++
      if (i.priority === 'Critical') critical++
      if (isOverdue(i, evalTime)) overdue++
    }
    return { active, critical, overdue, onDuty: positions.filter(p => !p.stale).length }
  }, [shownIncidents, positions, evalTime])

  const statusCounts = useMemo(() => {
    const c = { all: shownIncidents.length, active: 0, pending: 0, assigned: 0, resolved: 0 }
    for (const i of shownIncidents) {
      if (c[i.status] !== undefined) c[i.status]++
      if (i.status === 'pending' || i.status === 'assigned') c.active++
    }
    return c
  }, [shownIncidents])

  const categoryCounts = useMemo(() => {
    const c = {}
    for (const i of shownIncidents) {
      if (!matchesStatus(i, statusFilter)) continue
      const k = i.category || 'Other'
      c[k] = (c[k] || 0) + 1
    }
    return c
  }, [shownIncidents, statusFilter])

  // ---- filtering ----
  const query = search.trim().toLocaleLowerCase()
  const filtered = useMemo(() => shownIncidents.filter(i => {
    if (!matchesStatus(i, statusFilter)) return false
    if (categoryFilter !== 'all' && i.category !== categoryFilter) return false
    if (quick === 'critical' && !(i.priority === 'Critical' && i.status !== 'resolved')) return false
    if (quick === 'overdue' && !isOverdue(i, evalTime)) return false
    if (focusIds && !focusIds.includes(i.id)) return false
    if (query && ![i.title, i.location, i.category, i.description]
      .some(v => String(v || '').toLocaleLowerCase().includes(query))) return false
    return true
  }), [shownIncidents, statusFilter, categoryFilter, quick, evalTime, focusIds, query])

  const mappable = useMemo(() => filtered.filter(hasCoords), [filtered])
  const noPin = useMemo(() => filtered.filter(i => !hasCoords(i)), [filtered])
  const pendingList = useMemo(() => mappable.filter(i => i.status === 'pending').sort(byUrgencyThenAge), [mappable])
  const assignedList = useMemo(() => mappable.filter(i => i.status === 'assigned').sort(byUrgencyThenAge), [mappable])
  const resolvedList = useMemo(() => mappable.filter(i => i.status === 'resolved')
    .sort((a, b) => new Date(b.resolved_at || b.updated_at || b.created_at) - new Date(a.resolved_at || a.updated_at || a.created_at)), [mappable])

  const filtersActive = statusFilter !== 'active' || categoryFilter !== 'all' || quick || focusIds || query

  // ---- selection, responders, routes ----
  const selected = useMemo(() => shownIncidents.find(i => i.id === selectedId) || null, [shownIncidents, selectedId])

  const activeCounts = useMemo(() => {
    const c = {}
    for (const i of incidents) if (i.status === 'assigned' && i.assigned_to) c[i.assigned_to] = (c[i.assigned_to] || 0) + 1
    return c
  }, [incidents])

  const responders = useMemo(
    () => (selected && hasCoords(selected) ? rankResponders(selected, livePositions, activeCounts) : []),
    [selected, livePositions, activeCounts]
  )

  const routeRequests = useMemo(() => {
    if (replaying || !layers.tanods) return []
    const pos = Object.fromEntries(livePositions.map(p => [p.tanodId, p]))
    return incidents
      .filter(i => i.status === 'assigned' && i.assigned_to && hasCoords(i) && pos[i.assigned_to])
      .map(i => {
        const p = pos[i.assigned_to]
        return {
          key: `${p.tanodId}:${i.id}`,
          tanodId: p.tanodId,
          incidentId: i.id,
          incidentTitle: i.title,
          from: [p.latitude, p.longitude],
          to: [i.latitude, i.longitude],
          stale: p.stale,
        }
      })
  }, [incidents, livePositions, replaying, layers.tanods])
  const routeResults = useRoadRoutes(routeRequests, now)
  const routes = useMemo(() => routeRequests.map(r => ({ ...r, ...routeResults[r.key] })), [routeRequests, routeResults])
  const routeByIncident = useMemo(() => Object.fromEntries(routes.map(r => [r.incidentId, r])), [routes])

  const measureResult = useMemo(() => {
    if (!measureCenter) return null
    return {
      incidents: mappable.filter(i => distanceMeters(measureCenter, [i.latitude, i.longitude]) <= MEASURE_RADIUS).length,
      tanods: positions.filter(p => distanceMeters(measureCenter, [p.latitude, p.longitude]) <= MEASURE_RADIUS).length,
    }
  }, [measureCenter, mappable, positions])

  // ---- layers popover: Escape or a click elsewhere closes it ----
  const layersRef = useRef(null)
  useEffect(() => {
    if (!layersOpen) return undefined
    const onKey = (e) => { if (e.key === 'Escape') setLayersOpen(false) }
    const onDown = (e) => { if (!layersRef.current?.contains(e.target)) setLayersOpen(false) }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [layersOpen])

  // ---- actions ----
  function selectFromQueue(inc) {
    setSelectedId(inc.id)
    if (hasCoords(inc)) setFlyTarget({ id: inc.id, nonce: Date.now() })
  }
  function selectFromMap(id) { setSelectedId(id) }
  function closeSelected() { setSelectedId(null); setSheet('peek') }
  function openGroup(group) {
    setFocusIds(group.map(g => g.id))
    if (!isDesktop) setSheet('queue')
  }
  function setStatus(value) { setPref?.('statusFilter', value); setQuick(null) }
  function toggleQuick(kind) {
    setQuick(q => (q === kind ? null : kind))
    if (statusFilter === 'resolved') setPref?.('statusFilter', 'active')
  }
  function resetFilters() {
    setPref?.('statusFilter', 'active')
    setPref?.('categoryFilter', 'all')
    setQuick(null); setSearch(''); setFocusIds(null)
  }
  function toggleMeasure() {
    setMeasuring(m => !m); setMeasureCenter(null)
    setReplaying(false); setPlaying(false); setReplayOffset(0)
  }
  function toggleReplay() {
    setReplaying(r => !r); setReplayOffset(0); setPlaying(false)
    setMeasuring(false); setMeasureCenter(null)
  }
  function toggleLayer(key) { setPref?.('layers', { ...layers, [key]: !layers[key] }) }
  async function dispatch(tanodId) {
    if (!selected) return
    setDispatching(tanodId)
    try { await onDispatch?.(selected, tanodId) } finally { setDispatching(null) }
  }

  const emptyMessage = shownIncidents.length === 0
    ? (replaying ? 'No reports had been filed by this time.' : 'No incidents reported yet.')
    : filtersActive ? 'No mapped incidents match these filters.' : 'Reports with a pinned location will appear here.'

  /* ------------------------------ pieces ------------------------------ */

  const rowFor = (inc) => {
    const cat = CATEGORY_CONFIG[inc.category] || CATEGORY_CONFIG.Other
    const late = overdueMs(inc, evalTime)
    const route = routeByIncident[inc.id]
    const tanodName = inc.assigned_to ? tanodById[inc.assigned_to]?.full_name : null
    const badges = []
    if (inc.status === 'pending') {
      badges.push(<span key="p" className={`${styles.badge} ${styles[PRIORITY_TONE[inc.priority] || 'tNeutral']}`}>{inc.priority || 'Medium'}</span>)
      if (late) badges.push(<span key="o" className={`${styles.badge} ${styles.tWarn}`}>Overdue by {durationText(late)}</span>)
    } else if (inc.status === 'assigned') {
      const eta = route?.status === 'ready' && Number.isFinite(route.seconds) ? ` · ${durationText(route.seconds * 1000)} away` : route?.status === 'stale' ? ' · signal lost' : ''
      badges.push(<span key="a" className={`${styles.badge} ${styles.tInfo}`}>{tanodName ? `${tanodName}${eta}` : 'Assigned'}</span>)
    } else {
      badges.push(<span key="r" className={`${styles.badge} ${styles.tOk}`}>Resolved {timeAgo(inc.resolved_at || inc.updated_at)}</span>)
    }
    return (
      <QueueRow
        key={inc.id}
        incident={inc}
        cat={cat}
        selected={inc.id === selectedId}
        meta={`${hasCoords(inc) ? (inc.location || 'Pinned on map') : 'No map pin'} · ${timeAgo(inc.created_at)}`}
        badges={badges}
        onSelect={selectFromQueue}
      />
    )
  }

  const shownProgress = showAllProgress ? assignedList : assignedList.slice(0, 3)
  // Resolved incidents are tucked away only when there is active work to
  // show above them. When the user asked for resolved ones, tapped a group,
  // or nothing active matches, they are the list.
  const resolvedIsMain = statusFilter === 'resolved' || Boolean(focusIds) ||
    (pendingList.length === 0 && assignedList.length === 0)

  const queuePanel = (
    <>
      <label className="sr-only" htmlFor="cm-search">Search incidents</label>
      <div className={styles.search}>
        <Search size={16} aria-hidden="true" />
        <input id="cm-search" type="search" className={styles.searchInput} placeholder="Search title, purok or street"
          value={search} onChange={e => setSearch(e.target.value)} />
        {search && (
          <button type="button" className={styles.clearSearch} aria-label="Clear search" onClick={() => setSearch('')}>
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>
      <div className={styles.chips} role="group" aria-label="Filter by status">
        {STATUS_FILTERS.map(f => (
          <button key={f.value} type="button" className={styles.chip} aria-pressed={statusFilter === f.value} onClick={() => setStatus(f.value)}>
            {f.label} {statusCounts[f.value]}
          </button>
        ))}
      </div>
      <div className={styles.filterRow}>
        <label className="sr-only" htmlFor="cm-category">Category</label>
        <select id="cm-category" className={styles.select} value={categoryFilter} onChange={e => setPref?.('categoryFilter', e.target.value)}>
          <option value="all">All categories</option>
          {Object.entries(CATEGORY_CONFIG).map(([key, c]) => ((categoryCounts[key] || categoryFilter === key)
            ? <option key={key} value={key}>{c.label} ({categoryCounts[key] || 0})</option>
            : null))}
        </select>
        {filtersActive && <button type="button" className={styles.resetLink} onClick={resetFilters}>Reset</button>}
      </div>
      {(focusIds || quick) && (
        <div className={styles.focusBanner}>
          <span>{focusIds ? `${focusIds.length} incidents from one spot on the map` : quick === 'critical' ? 'Critical incidents only' : 'Overdue incidents only'}</span>
          <button type="button" className={styles.resetLink} onClick={() => { setFocusIds(null); setQuick(null) }}>Show all</button>
        </div>
      )}

      {pendingList.length > 0 && (
        <>
          <p className={styles.sectionLabel}>Needs dispatch · {pendingList.length}</p>
          <div className={styles.list}>{pendingList.map(rowFor)}</div>
        </>
      )}
      {assignedList.length > 0 && (
        <>
          <p className={styles.sectionLabel}>In progress · {assignedList.length}</p>
          <div className={styles.list}>{shownProgress.map(rowFor)}</div>
          {assignedList.length > 3 && (
            <button type="button" className={styles.moreLink} onClick={() => setShowAllProgress(v => !v)}>
              {showAllProgress ? 'Show fewer' : `Show ${assignedList.length - 3} more in progress`}
            </button>
          )}
        </>
      )}
      {resolvedIsMain && resolvedList.length > 0 && (
        <>
          <p className={styles.sectionLabel}>Resolved · {resolvedList.length}</p>
          <div className={styles.list}>{resolvedList.map(rowFor)}</div>
        </>
      )}
      {filtered.length === 0 && (
        <p className={styles.emptyList}>
          {shownIncidents.length === 0 ? 'No incidents yet.' : 'Nothing matches these filters.'}
        </p>
      )}

      {((!resolvedIsMain && resolvedList.length > 0) || noPin.length > 0) && (
        <div className={styles.queueFooter}>
          {!resolvedIsMain && resolvedList.length > 0 && (
            <>
              <button type="button" className={styles.disclosure} aria-expanded={resolvedOpen} onClick={() => setResolvedOpen(v => !v)}>
                Resolved · {resolvedList.length}
                {resolvedOpen ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
              </button>
              {resolvedOpen && <div className={styles.list}>{resolvedList.map(rowFor)}</div>}
            </>
          )}
          {noPin.length > 0 && (
            <>
              <button type="button" className={styles.noPin} aria-expanded={noPinOpen} onClick={() => setNoPinOpen(v => !v)}>
                <MapPinOff size={16} aria-hidden="true" />
                <span style={{ flex: 1 }}>{noPin.length} report{noPin.length === 1 ? ' has' : 's have'} no map pin — review location</span>
                {noPinOpen ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
              </button>
              {noPinOpen && <div className={styles.list}>{noPin.map(rowFor)}</div>}
            </>
          )}
        </div>
      )}
    </>
  )

  const peekPanel = (
    <>
      <div className={styles.sheetHead}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className={styles.sheetTitle}>
            {pendingList.length ? `${pendingList.length} need${pendingList.length === 1 ? 's' : ''} dispatch` : 'Nothing waiting for dispatch'}
          </h2>
          <p className={styles.hint}>
            {assignedList.length} in progress{noPin.length ? ` · ${noPin.length} without a map pin` : ''}
          </p>
        </div>
        <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setSheet('queue')}>Full queue</button>
      </div>
      <div className={styles.list}>{pendingList.slice(0, 2).map(rowFor)}</div>
    </>
  )

  const drawerPanel = selected ? (
    <IncidentDrawer
      incident={selected}
      now={evalTime}
      replaying={replaying}
      atMs={atMs}
      responders={isDesktop ? responders.slice(0, 3) : responders.slice(0, 2)}
      route={routeByIncident[selected.id]}
      assignedTanod={selected.assigned_to ? tanodById[selected.assigned_to] : null}
      dispatching={dispatching}
      onDispatch={onDispatch ? dispatch : null}
      onClose={closeSelected}
      onOpenIncident={onOpenIncident}
    />
  ) : (
    <div className={styles.drawerEmpty}>
      <div>
        <MapPin size={26} aria-hidden="true" style={{ margin: '0 auto 8px' }} />
        <p style={{ margin: 0, fontWeight: 700, color: 'var(--cm-text)' }}>Select an incident</p>
        <p style={{ margin: '4px 0 0' }}>Pick one from the queue or tap a pin to see the closest responders.</p>
      </div>
    </div>
  )

  /* ------------------------------ layout ------------------------------ */

  return (
    <section className={styles.console} data-theme={theme} aria-label="Incident command console">
      <div className={styles.statBar}>
        <button type="button" className={`${styles.stat} ${styles.statActive}`}
          aria-pressed={statusFilter === 'active' && !quick && !focusIds}
          onClick={() => { setQuick(null); setFocusIds(null); setPref?.('statusFilter', 'active') }}>
          <span className={styles.statNum}>{stats.active}</span><span className={styles.statLabel}>Active</span>
        </button>
        <button type="button" className={`${styles.stat} ${styles.statCritical}`} aria-pressed={quick === 'critical'} onClick={() => toggleQuick('critical')}>
          {stats.critical > 0 && <span className={styles.critDot} aria-hidden="true" />}
          <span className={styles.statNum}>{stats.critical}</span><span className={styles.statLabel}>Critical</span>
        </button>
        <button type="button" className={`${styles.stat} ${styles.statOverdue}`} aria-pressed={quick === 'overdue'} onClick={() => toggleQuick('overdue')}>
          <span className={styles.statNum}>{stats.overdue}</span><span className={styles.statLabel}>Overdue</span>
        </button>
        <span className={`${styles.stat} ${styles.statDuty}`}>
          <span className={styles.statNum}>{stats.onDuty}</span><span className={styles.statLabel}>{isDesktop ? 'Tanods on duty' : 'On duty'}</span>
        </span>
        <p className={styles.showing}>
          Showing {filtered.length} of {shownIncidents.length} incident{shownIncidents.length === 1 ? '' : 's'}
          {replaying ? ` · as of ${new Date(atMs).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}` : ' · tap a count to filter'}
        </p>
      </div>

      <div className={styles.body}>
        {isDesktop && <aside className={styles.queue} aria-label="Incident queue">{queuePanel}</aside>}

        <div className={styles.mapArea}>
          {!layoutKnown ? <div className={styles.mapLoading}>Loading map…</div> : <IncidentMap
            incidents={mappable}
            tanods={positions}
            routes={routes}
            selectedId={selectedId}
            flyTarget={flyTarget}
            onSelect={selectFromMap}
            onOpenGroup={openGroup}
            theme={theme}
            basemap={basemap}
            layers={layers}
            coverageInput={layers.coverage ? { trailPoints: allTrailPoints, incidents: mappable } : null}
            measure={measureCenter ? { center: measureCenter, radius: MEASURE_RADIUS } : null}
            measuring={measuring}
            onMapClick={({ lat, lng }) => {
              if (measuring) setMeasureCenter([lat, lng])
            }}
            emptyMessage={emptyMessage}
            controlsPosition={isDesktop ? 'bottom-right' : 'top-right'}
            showZoom={isDesktop}
            fitPadding={isDesktop ? undefined : MOBILE_FIT_PADDING}
            flyOffset={isDesktop ? undefined : MOBILE_FLY_OFFSET}
          />}

          <div className={styles.toolbar}>
            <div className={styles.layersWrap} ref={layersRef}>
              <button type="button" className={styles.tool} aria-expanded={layersOpen} aria-controls="cm-layers" onClick={() => setLayersOpen(o => !o)}>
                <Layers size={16} aria-hidden="true" /> Layers <ChevronDown size={14} aria-hidden="true" className={styles.toolChevron} />
              </button>
              {layersOpen && (
                <div id="cm-layers" className={styles.popover}>
                  <p className={styles.popoverLabel}>Base map</p>
                  <div className={styles.segment} role="radiogroup" aria-label="Base map">
                    {BASEMAPS.map(b => (
                      <button key={b.id} type="button" role="radio" aria-checked={basemap === b.id} onClick={() => setPref?.('basemap', b.id)}>{b.label}</button>
                    ))}
                  </div>
                  <p className={styles.popoverLabel} style={{ marginTop: 18 }}>Show on map</p>
                  <SwitchRow title="On-duty tanods" hint="Live position and route" on={layers.tanods} onToggle={() => toggleLayer('tanods')} />
                  <SwitchRow title="Hotspot heatmap" hint="Where active incidents cluster" on={layers.heatmap} onToggle={() => toggleLayer('heatmap')} />
                  <SwitchRow title="Patrol gaps" hint="Areas not patrolled in 6 hours" on={layers.coverage} onToggle={() => toggleLayer('coverage')} />
                </div>
              )}
            </div>
            <button type="button" className={styles.tool} aria-pressed={measuring} onClick={toggleMeasure}>
              <CircleDot size={16} aria-hidden="true" /> {isDesktop ? `Measure ${MEASURE_RADIUS} m` : 'Measure'}
            </button>
            <button type="button" className={styles.tool} aria-pressed={replaying} onClick={toggleReplay}>
              <History size={16} aria-hidden="true" /> {isDesktop ? 'Replay 24 hr' : 'Replay'}
            </button>
            <button type="button" className={`${styles.iconButton} ${styles.legendToggle} ${styles.toolEnd}`}
              aria-label={legendOpen ? 'Hide legend' : 'Show legend'} aria-expanded={legendOpen} onClick={() => setLegendOpen(v => !v)}
              style={{ background: 'var(--cm-surface)', boxShadow: 'var(--cm-shadow)' }}>
              <Info size={17} aria-hidden="true" />
            </button>
          </div>

          {measuring && (
            <div className={styles.statusChip} role="status">
              <CircleDot size={14} aria-hidden="true" />
              <span className={styles.statusChipText}>
                {measureResult
                  ? `Within ${MEASURE_RADIUS} m: ${measureResult.incidents} incident${measureResult.incidents === 1 ? '' : 's'} · ${measureResult.tanods} tanod${measureResult.tanods === 1 ? '' : 's'}`
                  : `Tap the map to count what is within ${MEASURE_RADIUS} m`}
              </span>
              <button type="button" onClick={toggleMeasure}>Done</button>
            </div>
          )}

          {!replaying && (
            <div className={`${styles.legend} ${legendOpen ? styles.legendOpen : ''}`}>
              <p className={styles.legendTitle}>Pin color is the category</p>
              <div className={styles.legendItems}>
                <span className={styles.legendItem}><span className={`${styles.sw} ${styles.swPulse}`} />Needs dispatch</span>
                <span className={styles.legendItem}><span className={styles.sw} style={{ background: '#2563eb' }} />Assigned</span>
                <span className={styles.legendItem}><span className={styles.sw} style={{ background: '#dc2626' }}>!</span>Critical</span>
                <span className={styles.legendItem}><span className={styles.sw} style={{ background: '#f97316' }}>!</span>High</span>
                <span className={styles.legendItem}><span className={styles.sw} style={{ background: 'var(--brand)' }} />Grouped</span>
                {layers.tanods && <span className={styles.legendItem}><span className={styles.sw} style={{ background: '#16a34a' }} />Tanod</span>}
                {layers.tanods && <span className={styles.legendItem}><span className={styles.sw} style={{ background: '#d97706' }} />Signal lost</span>}
                {layers.tanods && <span className={styles.legendItem}><span className={styles.swRoute} />Route</span>}
                {layers.coverage && <span className={styles.legendItem}><span className={styles.sw} style={{ background: 'rgba(220,38,38,.25)', borderRadius: 3 }} />Not patrolled</span>}
              </div>
            </div>
          )}

          {replaying && (
            <div className={styles.replayBar}>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} style={{ width: 44, padding: 0, flexShrink: 0 }}
                aria-label={playing ? 'Pause replay' : 'Play forward to now'}
                onClick={() => { if (replayOffset === 0) setReplayOffset(REPLAY_MINUTES); setPlaying(p => !p) }}>
                {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
              </button>
              <input type="range" className={styles.replayRange} min={0} max={REPLAY_MINUTES} step={5}
                value={REPLAY_MINUTES - replayOffset} aria-label="Replay time"
                aria-valuetext={replayOffset === 0 ? 'Now' : `${durationText(replayOffset * 60000)} ago`}
                onChange={e => { setReplayOffset(REPLAY_MINUTES - Number(e.target.value)); setPlaying(false) }} />
              <span className={styles.replayTime}>
                <strong>{replayOffset === 0 ? 'Now' : `−${durationText(replayOffset * 60000)}`}</strong>
                <span>{new Date(atMs).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}</span>
              </span>
            </div>
          )}

          {!isDesktop && (
            <section className={`${styles.sheet} ${selected ? styles.sheetIncident : sheet === 'queue' ? styles.sheetTall : ''}`}
              aria-label={selected ? 'Selected incident' : 'Incident queue'}>
              <button type="button" className={styles.sheetHandle}
                aria-label={selected ? 'Close incident' : sheet === 'peek' ? 'Expand queue' : 'Collapse queue'}
                onClick={() => (selected ? closeSelected() : setSheet(s => (s === 'peek' ? 'queue' : 'peek')))}>
                <span />
              </button>
              {selected ? drawerPanel : sheet === 'queue' ? queuePanel : peekPanel}
            </section>
          )}
        </div>

        {isDesktop && selected && <aside className={styles.drawer} aria-label="Selected incident">{drawerPanel}</aside>}
      </div>
    </section>
  )
}

/* ------------------------------ parts ------------------------------ */

function QueueRow({ incident, cat, selected, meta, badges, onSelect }) {
  return (
    <button type="button" className={`${styles.row} ${incident.status === 'resolved' ? styles.rowResolved : ''}`}
      aria-current={selected || undefined} onClick={() => onSelect(incident)}>
      <span className={styles.tile} style={{ background: cat.bg, color: cat.color }}>
        <CategoryIcon category={incident.category} size={20} />
      </span>
      <span className={styles.rowText}>
        <span className={styles.rowTitle}>{incident.title}</span>
        <span className={styles.rowMeta}>{meta}</span>
        <span className={styles.badges}>{badges}</span>
      </span>
    </button>
  )
}

function SwitchRow({ title, hint, on, onToggle }) {
  return (
    <div className={styles.switchRow}>
      <div className={styles.switchText}>
        <p className={styles.switchTitle}>{title}</p>
        <p className={styles.switchHint}>{hint}</p>
      </div>
      <button type="button" role="switch" aria-checked={on} aria-label={title} className={styles.switch} onClick={onToggle}>
        <span />
      </button>
    </div>
  )
}

function Avatar({ person, tone }) {
  return (
    <span className={`${styles.avatar} ${styles[tone]}`}>
      {person?.avatar_url
        ? <img src={person.avatar_url} alt="" />
        : initials(person?.full_name)}
    </span>
  )
}

function IncidentDrawer({
  incident, now, replaying, atMs, responders, route, assignedTanod,
  dispatching, onDispatch, onClose, onOpenIncident,
}) {
  const cat = CATEGORY_CONFIG[incident.category] || CATEGORY_CONFIG.Other
  const legal = LEGAL_BASIS[incident.category]
  const late = overdueMs(incident, now)
  const reporter = incident.profiles
  const reporterPhone = reporter?.phone?.replace(/[^0-9+]/g, '')
  const tanodPhone = assignedTanod?.phone?.replace(/[^0-9+]/g, '')
  const pinned = hasCoords(incident)
  const priority = incident.priority || 'Medium'
  const canDispatch = incident.status === 'pending' && pinned && !replaying && onDispatch

  return (
    <>
      <div className={styles.drawerHead}>
        <span className={`${styles.tile} ${styles.tileLg}`} style={{ background: cat.bg, color: cat.color }}>
          <CategoryIcon category={incident.category} size={24} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className={styles.drawerTitle}>{incident.title}</h2>
          <div className={styles.badges} style={{ marginTop: 8 }}>
            <span className={`${styles.badge} ${styles[PRIORITY_TONE[priority] || 'tNeutral']}`}>{priority}</span>
            <span className={`${styles.badge} ${styles[STATUS_TONE[incident.status] || 'tNeutral']}`} title={fullDate(incident.created_at)}>
              <span className={styles.dot} />{STATUS_LABEL[incident.status] || incident.status} · {timeAgo(incident.created_at)}
            </span>
          </div>
        </div>
        <button type="button" className={styles.iconButton} aria-label="Close incident" onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <p className={styles.location}>
        <MapPin size={16} aria-hidden="true" />
        {incident.location || 'No location description'}
      </p>

      {replaying && (
        <div className={`${styles.notice} ${styles.noticeInfo}`}>
          <strong>Replay is on.</strong> You are viewing {new Date(atMs).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}. Dispatch is paused until you return to live.
        </div>
      )}
      {!pinned && (
        <div className={`${styles.notice} ${styles.noticeWarn}`}>
          <strong>No map pin.</strong> The reporter didn&apos;t pin a location, so responders can&apos;t be ranked by distance. Call them to confirm where it is.
        </div>
      )}
      {late > 0 && (
        <div className={`${styles.notice} ${styles.noticeWarn}`}>
          <strong>Overdue by {durationText(late)}.</strong> {priority} incidents should have a responder within {durationText(RESPONSE_WINDOW_MS[priority] ?? RESPONSE_WINDOW_MS.Medium)}.
        </div>
      )}
      {legal?.responseMode === 'refer_to_agency' && legal.agency && (
        <div className={`${styles.notice} ${styles.noticeRefer}`}>
          <strong>{legal.agency} leads this.</strong> Dispatch a tanod to secure the area, document and assist.
        </div>
      )}

      {reporter?.full_name && (
        <div className={styles.person}>
          <Avatar person={reporter} tone="avatarBrand" />
          <div className={styles.personText}>
            <p className={styles.personName}>{reporter.full_name}</p>
            <p className={styles.personMeta}>Reporter</p>
          </div>
          {reporterPhone && (
            <a href={`tel:${reporterPhone}`} className={styles.callLink}><Phone size={14} aria-hidden="true" />Call</a>
          )}
        </div>
      )}

      {incident.status === 'assigned' && (
        <div className={styles.person}>
          <Avatar person={assignedTanod} tone="avatarGreen" />
          <div className={styles.personText}>
            <p className={styles.personName}>{assignedTanod?.full_name || 'Assigned tanod'}</p>
            <p className={styles.personMeta}>
              {route?.status === 'ready' && Number.isFinite(route.seconds)
                ? `${formatDistance(route.meters)} by road · about ${durationText(route.seconds * 1000)} away`
                : route?.status === 'stale' ? 'Signal lost — location is over 5 minutes old'
                : route?.status === 'unavailable' ? 'Responding · road route unavailable'
                : route ? 'Responding · finding a road route…' : 'Assigned · not sharing location'}
            </p>
          </div>
          {tanodPhone && <a href={`tel:${tanodPhone}`} className={styles.callLink}><Phone size={14} aria-hidden="true" />Call</a>}
        </div>
      )}

      {canDispatch && (
        <div>
          <p className={styles.sectionLabel} style={{ margin: 0 }}>Closest responders</p>
          <p className={styles.hint}>Straight-line distance and travel time from live GPS</p>
        </div>
      )}
      {canDispatch && responders.length === 0 && (
        <div className={`${styles.notice} ${styles.noticeWarn}`}>No on-duty tanod is sharing their location right now.</div>
      )}
      {canDispatch && responders.length > 0 && (
        <div className={styles.responders}>
          {responders.map((r, i) => {
            const best = i === 0 && !r.stale
            const first = (r.tanod?.full_name || 'Tanod').split(' ')[0]
            const meta = r.stale
              ? `${formatDistance(r.meters)} · signal lost ${timeAgo(r.recordedAt)}`
              : `${formatDistance(r.meters)} · ${formatEta(r.etaMoto)} ride · ${r.load ? `${r.load} active` : 'free'}`
            const button = (
              <button type="button" className={`${styles.btn} ${best ? `${styles.btnPrimary} ${styles.btnWide}` : styles.btnSecondary}`}
                disabled={dispatching != null} onClick={() => onDispatch(r.tanodId)}>
                {best && <Send size={16} aria-hidden="true" />}
                {dispatching === r.tanodId ? 'Dispatching…' : best ? `Dispatch ${first}` : 'Dispatch'}
              </button>
            )
            return (
              <div key={r.tanodId} className={`${styles.responder} ${best ? styles.responderBest : ''}`}>
                <div className={styles.responderRow}>
                  <Avatar person={r.tanod} tone={r.stale ? 'avatarAmber' : 'avatarGreen'} />
                  <div className={styles.personText}>
                    <p className={styles.personName}>{r.tanod?.full_name || 'Tanod'}{best && <span className={styles.nearest}>Nearest</span>}</p>
                    <p className={styles.personMeta}>{meta}</p>
                  </div>
                  {!best && button}
                </div>
                {best && button}
              </div>
            )
          })}
        </div>
      )}

      <div className={styles.drawerFooter}>
        {onOpenIncident && (
          <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => onOpenIncident(incident)}>Open full incident</button>
        )}
        {pinned && (
          <a className={`${styles.btn} ${styles.btnGhost}`} target="_blank" rel="noopener noreferrer"
            href={`https://www.google.com/maps/dir/?api=1&destination=${incident.latitude},${incident.longitude}`}>
            <Navigation size={15} aria-hidden="true" />Directions
          </a>
        )}
      </div>
    </>
  )
}
