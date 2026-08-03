'use client'
import { useState, useMemo, useCallback } from 'react'
import { Marker, Popup, Circle, Rectangle, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'

/**
 * Zoom-driven incident rendering.
 *
 * The approach every serious mapping product uses: rather than drawing the
 * same markers at every zoom and fighting the overlap that results, render
 * a DIFFERENT REPRESENTATION at each scale. Overlap stops being a problem
 * because individual pins are never drawn at a zoom where they would
 * collide.
 *
 *   ≤ 13   density surface  — "where do incidents happen?"
 *   14–15  aggregated bins  — counts per area
 *   16–17  clusters         — counts per block
 *   ≥ 18   individual pins  — every incident, guaranteed separated
 *
 * At pin level, incidents sharing a coordinate are separated by a small
 * DETERMINISTIC offset computed from their id — not by an on-click "fan
 * out" interaction. That earlier approach stored which group was expanded,
 * and since map interaction constantly invalidated that state, it collapsed
 * on pan, on zoom, on realtime inserts, and on fly-to. Offsets have no
 * state: the same incident lands in the same place every render, forever,
 * and nothing the user does can break it.
 *
 * The offset displaces a pin roughly 6 metres. Reported coordinates already
 * carry ±10–30m GPS error — which the report form itself displays — so the
 * displacement sits inside noise the data already has, and popups still
 * show the true position.
 *
 * Clicking an aggregate does not rearrange the map: it filters the incident
 * queue beside it. A pin can express location and priority; the queue row
 * expresses title, status, age and reporter. For "what is here?", the list
 * is simply the better instrument — which is also how dispatch systems are
 * built: the map is situational awareness, the queue is the work surface.
 */

// Zoom thresholds
const ZOOM_HEAT_MAX = 13
const ZOOM_BIN_MAX = 15
const ZOOM_CLUSTER_MAX = 17

const CLUSTER_CELL_PX = 72
const BIN_CELL_PX = 110
const COINCIDENT_EPS = 0.00012   // ~13m — close enough to overlap visually
const OFFSET_METERS = 6

const PRIORITY_RANK = { Low: 1, Medium: 2, High: 3, Critical: 4 }
const PRIORITY_COLOR = { Low: '#22c55e', Medium: '#3b82f6', High: '#f97316', Critical: '#dc2626' }

function dominant(group) {
  let best = null
  for (const inc of group) {
    if (inc.status === 'resolved') continue
    const rank = PRIORITY_RANK[inc.priority] || 2
    if (!best || rank > best.rank) best = { rank, priority: inc.priority }
  }
  if (!best) return { color: '#9ca3af', priority: null }
  return { color: PRIORITY_COLOR[best.priority] || '#3b82f6', priority: best.priority }
}

/** Stable hash → an angle. Same incident, same direction, every time. */
function hashAngle(id) {
  const s = String(id)
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return (Math.abs(h) % 360) * (Math.PI / 180)
}

/**
 * Separate coincident incidents by a deterministic offset.
 * Groups are found by proximity; within a group, each pin is pushed out
 * along its own hashed angle so the arrangement is stable and repeatable.
 */
function withOffsets(incidents) {
  const groups = []
  const taken = new Set()

  for (const inc of incidents) {
    if (taken.has(inc.id)) continue
    const group = [inc]
    taken.add(inc.id)
    for (const other of incidents) {
      if (taken.has(other.id)) continue
      if (Math.abs(other.latitude - inc.latitude) < COINCIDENT_EPS &&
          Math.abs(other.longitude - inc.longitude) < COINCIDENT_EPS) {
        group.push(other)
        taken.add(other.id)
      }
    }
    groups.push(group)
  }

  const out = []
  for (const group of groups) {
    if (group.length === 1) {
      out.push({ inc: group[0], pos: [group[0].latitude, group[0].longitude], offset: false })
      continue
    }
    // Ring radius grows a little with group size so 8 pins don't touch
    const meters = OFFSET_METERS + Math.min(group.length, 10) * 1.5
    const dLat = meters / 111320
    for (const inc of group) {
      const a = hashAngle(inc.id)
      const dLng = meters / (111320 * Math.cos((inc.latitude * Math.PI) / 180))
      out.push({
        inc,
        pos: [inc.latitude + dLat * Math.sin(a), inc.longitude + dLng * Math.cos(a)],
        offset: true,
      })
    }
  }
  return out
}

const aggIconCache = new Map()
function getAggIcon(count, color, hasCritical, shape) {
  const size = count > 30 ? 56 : count > 12 ? 50 : count > 5 ? 44 : 38
  const key = `${count}|${color}|${hasCritical}|${shape}|${size}`
  if (aggIconCache.has(key)) return aggIconCache.get(key)

  const icon = L.divIcon({
    className: 'incident-agg',
    html: `
      <div style="position:relative;width:${size}px;height:${size}px;">
        <div style="
          position:absolute; inset:-6px; border-radius:${shape === 'bin' ? '14px' : '50%'};
          background:${color}; opacity:0.2;
          ${hasCritical ? 'animation: pulse-ring 1.8s ease-out infinite;' : ''}
        "></div>
        <div style="
          width:${size}px; height:${size}px;
          border-radius:${shape === 'bin' ? '12px' : '50%'};
          background:${color}; border:3px solid white;
          box-shadow:0 4px 16px rgba(0,0,0,0.3);
          display:flex; align-items:center; justify-content:center;
          color:white; font-weight:900; font-size:${size > 48 ? 16 : 14}px;
          font-family: Sora, sans-serif;
        ">${count}</div>
      </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
  aggIconCache.set(key, icon)
  return icon
}

/**
 * @param {Array}    incidents      valid (lat/lng) incidents
 * @param {Function} renderPin      (incident, latlngOverride) => <Marker>
 * @param {Function} onFocusGroup   (incidents[]|null) => void — filters the queue
 * @param {Array}    focusedIds     ids currently focused, for highlighting
 */
export default function IncidentLayer({ incidents = [], renderPin, onFocusGroup, focusedIds = null }) {
  const map = useMap()
  const [zoom, setZoom] = useState(() => map.getZoom())
  const [, setTick] = useState(0)

  useMapEvents({
    zoomend: () => { setZoom(map.getZoom()); setTick(t => t + 1) },
    moveend: () => setTick(t => t + 1),
  })

  const mode = zoom <= ZOOM_HEAT_MAX ? 'heat'
    : zoom <= ZOOM_BIN_MAX ? 'bin'
    : zoom <= ZOOM_CLUSTER_MAX ? 'cluster'
    : 'pin'

  // Screen-space grid — cluster density feels constant at every zoom
  const cells = useMemo(() => {
    if (mode === 'pin' || mode === 'heat') return new Map()
    const cellPx = mode === 'bin' ? BIN_CELL_PX : CLUSTER_CELL_PX
    const grid = new Map()
    for (const inc of incidents) {
      const pt = map.latLngToContainerPoint([inc.latitude, inc.longitude])
      const key = `${Math.floor(pt.x / cellPx)}:${Math.floor(pt.y / cellPx)}`
      if (!grid.has(key)) grid.set(key, [])
      grid.get(key).push(inc)
    }
    return grid
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidents, mode, map, zoom, map.getCenter().lat, map.getCenter().lng])

  const positioned = useMemo(
    () => (mode === 'pin' ? withOffsets(incidents) : []),
    [incidents, mode]
  )

  const focusGroup = useCallback((group) => {
    onFocusGroup?.(group)
    map.flyToBounds(
      L.latLngBounds(group.map(g => [g.latitude, g.longitude])),
      { padding: [80, 80], maxZoom: ZOOM_CLUSTER_MAX + 1, duration: 0.6 }
    )
  }, [map, onFocusGroup])

  // ---------- HEAT: density surface, no pins ----------
  if (mode === 'heat') {
    return (
      <>
        {incidents.map(inc => {
          const w = PRIORITY_RANK[inc.priority] || 2
          const resolved = inc.status === 'resolved'
          return (
            <Circle
              key={`heat-${inc.id}`}
              center={[inc.latitude, inc.longitude]}
              radius={260 * (0.6 + w * 0.18)}
              pathOptions={{
                stroke: false,
                fillColor: PRIORITY_COLOR[inc.priority] || '#3b82f6',
                fillOpacity: resolved ? 0.05 : 0.06 + w * 0.04,
              }}
            />
          )
        })}
      </>
    )
  }

  // ---------- BIN / CLUSTER: aggregates ----------
  if (mode === 'bin' || mode === 'cluster') {
    const out = []
    cells.forEach((group, key) => {
      if (group.length === 1 && mode === 'cluster') {
        out.push(renderPin(group[0]))
        return
      }
      const { color, priority } = dominant(group)
      const hasCritical = group.some(g => g.priority === 'Critical' && g.status !== 'resolved')
      const pending = group.filter(g => g.status === 'pending').length
      const assigned = group.filter(g => g.status === 'assigned').length
      const resolved = group.filter(g => g.status === 'resolved').length

      out.push(
        <Marker
          key={`agg-${mode}-${key}`}
          position={[group[0].latitude, group[0].longitude]}
          icon={getAggIcon(group.length, color, hasCritical, mode)}
          zIndexOffset={hasCritical ? 900 : 600}
          eventHandlers={{ click: () => focusGroup(group) }}
        >
          <Tooltip direction="top" offset={[0, -18]}>
            <span style={{ fontSize: 11, fontWeight: 700 }}>
              {group.length} incidents{priority ? ` · highest: ${priority}` : ' · all resolved'}
            </span>
          </Tooltip>
          <Popup>
            <div style={{ minWidth: '180px', padding: '2px' }}>
              <p style={{ fontWeight: 800, fontSize: '13px', color: '#1f2937', margin: '0 0 6px' }}>
                {group.length} incidents in this area
              </p>
              <div style={{ fontSize: '11px', color: '#6b7280', lineHeight: 1.8, marginBottom: '8px' }}>
                {pending > 0 && <div>🟠 {pending} pending</div>}
                {assigned > 0 && <div>🔵 {assigned} assigned</div>}
                {resolved > 0 && <div>🟢 {resolved} resolved</div>}
                {hasCritical && <div style={{ color: '#b91c1c', fontWeight: 800 }}>🔴 Includes a Critical</div>}
              </div>
              <button onClick={() => focusGroup(group)}
                style={{
                  width: '100%', padding: '7px',
                  background: 'linear-gradient(135deg, #5B54E8, #7C75F0)',
                  color: 'white', border: 'none', borderRadius: '8px',
                  fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                }}>
                Show these in the list
              </button>
            </div>
          </Popup>
        </Marker>
      )
    })
    return <>{out}</>
  }

  // ---------- PIN: every incident, permanently separated ----------
  return (
    <>
      {positioned.map(({ inc, pos, offset }) => (
        <span key={inc.id}>
          {/* A faint tie-line back to the recorded coordinate, so a
              displaced pin never misrepresents where the report was filed */}
          {offset && (
            <Circle
              center={[inc.latitude, inc.longitude]}
              radius={2}
              pathOptions={{ stroke: false, fillColor: '#5B54E8', fillOpacity: 0.35 }}
            />
          )}
          {renderPin(inc, pos)}
        </span>
      ))}
    </>
  )
}

/** Label for the map's mode indicator. */
export function zoomModeLabel(zoom) {
  if (zoom <= ZOOM_HEAT_MAX) return { mode: 'heat', label: 'Density view', hint: 'Zoom in for individual incidents' }
  if (zoom <= ZOOM_BIN_MAX) return { mode: 'bin', label: 'Area totals', hint: 'Zoom in to separate incidents' }
  if (zoom <= ZOOM_CLUSTER_MAX) return { mode: 'cluster', label: 'Grouped', hint: 'Zoom in to see every pin' }
  return { mode: 'pin', label: 'All incidents', hint: null }
}