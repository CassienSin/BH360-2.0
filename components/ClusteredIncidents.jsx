'use client'
import { useState, useMemo, useCallback, useEffect } from 'react'
import { Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'

/**
 * Clustered incident markers.
 *
 * The problem: markers at or near the same coordinates stack, and which one
 * lands on top is arbitrary. An official can be looking at a resolved noise
 * complaint while a critical fire sits invisible underneath it.
 *
 * CLUSTERING groups nearby pins into a counted bubble coloured by the
 * HIGHEST priority inside, so a cluster containing one Critical reads red
 * even if nine others are resolved. Grouping happens in SCREEN space, so
 * cluster density feels the same at every zoom.
 *
 * SPIDERFY fans out pins that sit within ~9m of each other, which zooming
 * can never separate.
 *
 * A note on why spiderfy is keyed the way it is: the obvious approach is to
 * remember which grid cell was expanded. That breaks immediately — cell
 * keys are derived from screen position, so panning by a single pixel
 * renames every cell and the expansion silently collapses. Instead the
 * expanded set is remembered by INCIDENT ID, and those incidents are pulled
 * out of clustering entirely while fanned. Panning and zooming then leave
 * the expansion completely alone.
 */

const CLUSTER_CELL_PX = 70      // grid cell size for clustering, in pixels
const COINCIDENT_EPS = 0.00008  // ~9m — treat as "same spot", spiderfy instead of zoom
const SPIDER_BASE_RADIUS = 48

const PRIORITY_RANK = { Low: 1, Medium: 2, High: 3, Critical: 4 }
const PRIORITY_COLOR = {
  Low: '#22c55e',
  Medium: '#3b82f6',
  High: '#f97316',
  Critical: '#dc2626',
}

/** Highest-priority colour among unresolved incidents in the group. */
function clusterColor(group) {
  let best = null
  for (const inc of group) {
    if (inc.status === 'resolved') continue
    const rank = PRIORITY_RANK[inc.priority] || 2
    if (!best || rank > best.rank) best = { rank, priority: inc.priority }
  }
  if (!best) return '#9ca3af'   // all resolved → muted
  return PRIORITY_COLOR[best.priority] || '#3b82f6'
}

const clusterIconCache = new Map()
function getClusterIcon(count, color, hasCritical) {
  const size = count > 20 ? 54 : count > 8 ? 48 : 42
  const key = `${count}|${color}|${hasCritical}`
  if (clusterIconCache.has(key)) return clusterIconCache.get(key)

  const icon = L.divIcon({
    className: 'incident-cluster',
    html: `
      <div style="position:relative;width:${size}px;height:${size}px;">
        <div style="
          position:absolute; inset:-7px; border-radius:50%;
          background:${color}; opacity:0.22;
          ${hasCritical ? 'animation: pulse-ring 1.8s ease-out infinite;' : ''}
        "></div>
        <div style="
          width:${size}px; height:${size}px; border-radius:50%;
          background:${color}; border:3px solid white;
          box-shadow:0 4px 16px rgba(0,0,0,0.32);
          display:flex; align-items:center; justify-content:center;
          color:white; font-weight:900; font-size:${size > 48 ? 16 : 14}px;
          font-family: Sora, sans-serif;
        ">${count}</div>
      </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
  clusterIconCache.set(key, icon)
  return icon
}

/**
 * @param {Array}    incidents   valid (lat/lng present) incidents
 * @param {Function} renderPin   (incident, latlngOverride) => <Marker>
 */
export default function ClusteredIncidents({ incidents, renderPin }) {
  const map = useMap()
  const [, setTick] = useState(0)
  // Set of incident ids currently fanned out. Identity-based, so it
  // survives every pan and zoom.
  const [spiderIds, setSpiderIds] = useState(null)

  // Re-cluster on viewport change. Deliberately does NOT clear the
  // expansion — a fly-to triggered by selecting a pin fires these same
  // events, and collapsing there would destroy the marker the user just
  // opened, taking its popup with it.
  useMapEvents({
    zoomend: () => setTick(t => t + 1),
    moveend: () => setTick(t => t + 1),
    // Only a deliberate click on the map background collapses the fan.
    click: () => setSpiderIds(null),
  })

  // If the expanded incidents disappear (filtered out, resolved elsewhere),
  // drop the expansion rather than rendering a fan of nothing.
  useEffect(() => {
    if (!spiderIds) return
    const present = incidents.some(i => spiderIds.has(i.id))
    if (!present) setSpiderIds(null)
  }, [incidents, spiderIds])

  const spiderGroup = useMemo(
    () => (spiderIds ? incidents.filter(i => spiderIds.has(i.id)) : []),
    [incidents, spiderIds]
  )

  // Everything not currently fanned out goes through normal clustering
  const clustered = useMemo(
    () => (spiderIds ? incidents.filter(i => !spiderIds.has(i.id)) : incidents),
    [incidents, spiderIds]
  )

  const cells = useMemo(() => {
    const grid = new Map()
    for (const inc of clustered) {
      const pt = map.latLngToContainerPoint([inc.latitude, inc.longitude])
      const key = `${Math.floor(pt.x / CLUSTER_CELL_PX)}:${Math.floor(pt.y / CLUSTER_CELL_PX)}`
      if (!grid.has(key)) grid.set(key, [])
      grid.get(key).push(inc)
    }
    return grid
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clustered, map, map.getZoom(), map.getCenter().lat, map.getCenter().lng])

  const handleClusterClick = useCallback((group, coincident) => {
    if (coincident || map.getZoom() >= 18) {
      setSpiderIds(new Set(group.map(g => g.id)))
    } else {
      map.flyToBounds(
        L.latLngBounds(group.map(g => [g.latitude, g.longitude])),
        { padding: [70, 70], maxZoom: 18 }
      )
    }
  }, [map])

  const out = []

  // ---- Fanned-out group (rendered outside clustering entirely) ----
  if (spiderGroup.length > 0) {
    const anchor = [spiderGroup[0].latitude, spiderGroup[0].longitude]
    const centerPt = map.latLngToContainerPoint(anchor)
    const radius = SPIDER_BASE_RADIUS + Math.min(spiderGroup.length, 10) * 3

    spiderGroup.forEach((inc, i) => {
      const angle = (2 * Math.PI * i) / spiderGroup.length - Math.PI / 2
      const pt = L.point(
        centerPt.x + radius * Math.cos(angle),
        centerPt.y + radius * Math.sin(angle)
      )
      const latlng = map.containerPointToLatLng(pt)
      out.push(
        <Polyline
          key={`spider-line-${inc.id}`}
          positions={[[inc.latitude, inc.longitude], [latlng.lat, latlng.lng]]}
          pathOptions={{ color: '#5B54E8', weight: 1.5, opacity: 0.55, dashArray: '3,4' }}
        />
      )
      out.push(renderPin(inc, [latlng.lat, latlng.lng]))
    })
  }

  // ---- Everything else ----
  cells.forEach((group, key) => {
    if (group.length === 1) {
      out.push(renderPin(group[0]))
      return
    }

    const coincident = group.every(g =>
      Math.abs(g.latitude - group[0].latitude) < COINCIDENT_EPS &&
      Math.abs(g.longitude - group[0].longitude) < COINCIDENT_EPS
    )

    const color = clusterColor(group)
    const hasCritical = group.some(g => g.priority === 'Critical' && g.status !== 'resolved')
    const pending = group.filter(g => g.status === 'pending').length
    const assigned = group.filter(g => g.status === 'assigned').length
    const resolved = group.filter(g => g.status === 'resolved').length

    out.push(
      <Marker
        key={`cluster-${key}`}
        position={[group[0].latitude, group[0].longitude]}
        icon={getClusterIcon(group.length, color, hasCritical)}
        zIndexOffset={hasCritical ? 900 : 600}
        eventHandlers={{ click: () => handleClusterClick(group, coincident) }}
      >
        <Popup>
          <div style={{ minWidth: '190px', padding: '2px' }}>
            <p style={{ fontWeight: 800, fontSize: '13px', color: '#1f2937', margin: '0 0 6px' }}>
              {group.length} incidents here
            </p>
            <div style={{ fontSize: '11px', color: '#6b7280', lineHeight: 1.8, marginBottom: '8px' }}>
              {pending > 0 && <div>🟠 {pending} pending</div>}
              {assigned > 0 && <div>🔵 {assigned} assigned</div>}
              {resolved > 0 && <div>🟢 {resolved} resolved</div>}
              {hasCritical && (
                <div style={{ color: '#b91c1c', fontWeight: 800 }}>🔴 Includes a Critical incident</div>
              )}
            </div>
            <button
              onClick={() => handleClusterClick(group, coincident)}
              style={{
                width: '100%', padding: '7px',
                background: 'linear-gradient(135deg, #5B54E8, #7C75F0)',
                color: 'white', border: 'none', borderRadius: '8px',
                fontSize: '11px', fontWeight: 700, cursor: 'pointer',
              }}>
              {coincident || map.getZoom() >= 18 ? 'Fan out pins' : 'Zoom in'}
            </button>
          </div>
        </Popup>
      </Marker>
    )
  })

  return <>{out}</>
}