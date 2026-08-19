'use client'
// NOTE: Leaflet touches `window` at import time — load this with SSR disabled:
//   const IncidentMap = dynamic(() => import('@/components/IncidentMap'), { ssr: false })
import { useEffect, useRef, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip, useMap, useMapEvents, LayersControl } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin, Layers as LayersIcon } from 'lucide-react'
import { timeAgo, fullDate } from '@/lib/timeAgo'
import IncidentLayer, { zoomModeLabel } from '@/components/IncidentLayer'
import { CoverageLayer, RadiusTool } from '@/components/MapLayers'
import { CATEGORY_CONFIG as categoryConfig } from '@/lib/legalBasis'


const PRIORITY_STYLES = {
  Critical: { bg: '#fee2e2', color: '#b91c1c' },
  High: { bg: '#ffedd5', color: '#c2410c' },
  Medium: { bg: '#fef9c3', color: '#a16207' },
  Low: { bg: '#f0fdf4', color: '#15803d' },
}

// A tanod is "stale" if their newest point is older than this — likely
// phone locked or app backgrounded. Shown amber instead of green.
const TANOD_STALE_MS = 5 * 60 * 1000

// Inject keyframes ONCE per page: marker pulse and route dash flow.
if (typeof document !== 'undefined' && !document.getElementById('incident-map-styles')) {
  const style = document.createElement('style')
  style.id = 'incident-map-styles'
  style.textContent = `
    @keyframes pulse-ring {
      0% { transform: scale(0.7); opacity: 0.7; }
      70% { transform: scale(1.9); opacity: 0; }
      100% { transform: scale(0.7); opacity: 0; }
    }
    @keyframes route-dash {
      to { stroke-dashoffset: -22; }
    }
    .route-line {
      animation: route-dash 1.1s linear infinite;
    }
    .leaflet-container {
      font-family: Sora, sans-serif;
    }
    /* Leaflet's CONTROLS sit at z-index 1000, which outranks app modals and
       lets them punch through a lightbox. Cap the controls only — never
       .leaflet-pane, whose z-index ordering is what stacks the tile layers
       and drives the zoom cross-fade. */
    .leaflet-container { z-index: 1; }
    .leaflet-top, .leaflet-bottom { z-index: 400 !important; }
    
    /* Dark operations theme — for night shift. A white map in a dark
       barangay hall causes glare and kills night vision. */
    .imap-dark .leaflet-container { background: #0f1117; }
    .imap-dark .leaflet-popup-content-wrapper,
    .imap-dark .leaflet-popup-tip { background: #1c2030; color: #e8eaf2; }
    .imap-dark .leaflet-control-layers,
    .imap-dark .leaflet-bar a {
      background: #1c2030; color: #e8eaf2; border-color: #242938;
    }
    .imap-dark .leaflet-bar a:hover { background: #242938; }
  `
  document.head.appendChild(style)
}

// ---- Route helpers ----
function curvedPath(from, to, curvature = 0.18, segments = 28) {
  const midLat = (from[0] + to[0]) / 2
  const midLng = (from[1] + to[1]) / 2
  const dLat = to[0] - from[0]
  const dLng = to[1] - from[1]
  const cLat = midLat - dLng * curvature
  const cLng = midLng + dLat * curvature
  const pts = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    pts.push([
      (1 - t) * (1 - t) * from[0] + 2 * (1 - t) * t * cLat + t * t * to[0],
      (1 - t) * (1 - t) * from[1] + 2 * (1 - t) * t * cLng + t * t * to[1],
    ])
  }
  return pts
}

function distanceMeters(a, b) {
  const R = 6371000
  const toRad = d => d * Math.PI / 180
  const dLat = toRad(b[0] - a[0])
  const dLng = toRad(b[1] - a[1])
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

function fmtDist(m) {
  return m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`
}

// ---- Incident pins ----
// Teardrop markers: the TIP marks the exact coordinate, which is far more
// precise than a floating circle. Category colour fills the pin, the emoji
// sits in a white well, pending pins pulse at ground level, Critical pins
// get a red "!" badge, resolved pins fade with a ✓.
//
// Cached by category|status|priority — deliberately NOT by selection state.
// Rebuilding an icon makes react-leaflet tear down and recreate the marker's
// DOM, which closes any popup the user just opened. Selection is expressed
// through zIndexOffset instead, which costs no re-render.
const iconCache = new Map()
function getIcon(category, status, priority) {
  const key = `${category}|${status}|${priority || ''}`
  if (iconCache.has(key)) return iconCache.get(key)

  const cat = categoryConfig[category] || categoryConfig.Other
  const isPending = status === 'pending'
  const isResolved = status === 'resolved'
  const isCritical = priority === 'Critical' && !isResolved

  const icon = L.divIcon({
    className: 'incident-pin',
    html: `
      <div style="position: relative; width: 40px; height: 52px; ${isResolved ? 'opacity: 0.6;' : ''}">
        ${isPending ? `<div style="
          position: absolute;
          left: 50%; bottom: 0;
          width: 26px; height: 26px;
          transform: translate(-50%, 40%);
          border-radius: 50%;
          background: ${cat.color}55;
          animation: pulse-ring 1.8s ease-out infinite;
        "></div>` : ''}
        <svg width="40" height="52" viewBox="0 0 40 52" style="position:absolute; left:0; top:0; filter: drop-shadow(0 3px 4px rgba(0,0,0,0.35));">
          <path d="M20 1C9.6 1 1.5 9.2 1.5 19.4 1.5 32 20 51 20 51s18.5-19 18.5-31.6C38.5 9.2 30.4 1 20 1z"
            fill="${cat.color}" stroke="white" stroke-width="2.5"/>
          <circle cx="20" cy="19" r="12" fill="white"/>
        </svg>
        <div style="
          position: absolute; left: 50%; top: 19px;
          transform: translate(-50%, -50%);
          font-size: 15px; line-height: 1;
        ">${cat.emoji}</div>
        ${isCritical ? `<div style="
          position: absolute; top: -4px; right: -2px;
          width: 16px; height: 16px;
          border-radius: 50%;
          background: #dc2626;
          border: 2px solid white;
          display: flex; align-items: center; justify-content: center;
          color: white; font-size: 10px; font-weight: 900;
          box-shadow: 0 2px 6px rgba(220,38,38,0.5);
        ">!</div>` : ''}
        ${isResolved ? `<div style="
          position: absolute; top: -3px; right: 0;
          width: 15px; height: 15px;
          border-radius: 50%;
          background: #22c55e;
          border: 2px solid white;
          display: flex; align-items: center; justify-content: center;
          color: white; font-size: 8px; font-weight: 900;
        ">✓</div>` : ''}
      </div>
    `,
    iconSize: [40, 52],
    iconAnchor: [20, 51],     // the pin TIP marks the coordinate
    popupAnchor: [0, -46],
  })
  iconCache.set(key, icon)
  return icon
}

// Tanod markers — profile photo when available, initial or shield as
// fallback. Colored ring doubles as status: green = fresh, amber = stale.
function getTanodIcon(stale, avatarUrl, initial) {
  const key = `tanod|${stale ? 'stale' : 'fresh'}|${avatarUrl || 'none'}|${initial || ''}`
  if (iconCache.has(key)) return iconCache.get(key)

  const color = stale ? '#f59e0b' : '#22c55e'
  const inner = avatarUrl
    ? `<img src="${avatarUrl}" alt="" style="
        width: 100%; height: 100%; object-fit: cover; border-radius: 50%;
      " onerror="this.style.display='none'" />`
    : ''

  const icon = L.divIcon({
    className: 'tanod-marker',
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center;">
        ${!stale ? `<div style="
          position: absolute;
          width: 46px; height: 46px;
          border-radius: 50%;
          background: ${color}40;
          animation: pulse-ring 2s ease-out infinite;
        "></div>` : ''}
        <div style="
          width: 36px; height: 36px;
          background: ${color};
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 12px ${color}80;
          border: 3px solid ${color};
          overflow: hidden;
          font-size: ${avatarUrl ? '13px' : '16px'};
          color: white; font-weight: 800;
          font-family: Sora, sans-serif;
        ">
          ${inner}${avatarUrl ? '' : (initial ? initial : '🛡️')}
        </div>
        <div style="
          position: absolute; bottom: -2px; right: -2px;
          width: 13px; height: 13px;
          border-radius: 50%;
          background: ${color};
          border: 2px solid white;
          display: flex; align-items: center; justify-content: center;
          font-size: 7px;
        ">🛡️</div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  })
  iconCache.set(key, icon)
  return icon
}

function FitBounds({ incidents, tanodPositions }) {
  const map = useMap()
  const done = useRef(false)

  useEffect(() => {
    // Fit ONCE on first load, then never again. Re-fitting whenever the
    // incident set changes fought with user panning and with FlyToSelected,
    // producing a map that zoomed and re-centred on its own.
    if (done.current) return
    const allPoints = [
      ...incidents.map(i => [i.latitude, i.longitude]),
      ...tanodPositions.map(t => [t.latitude, t.longitude]),
    ]
    if (allPoints.length === 0) return
    done.current = true

    if (allPoints.length === 1) {
      map.setView(allPoints[0], 17)
    } else {
      map.fitBounds(L.latLngBounds(allPoints), { padding: [50, 50], maxZoom: 17 })
    }
  }, [incidents, tanodPositions, map])
  return null
}

/** Flies to an incident selected from the QUEUE. Pin clicks don't fly —
    the user can already see that pin, and moving the map under them is
    disorienting. */
function FlyToSelected({ incidents, selectedId, skipRef }) {
  const map = useMap()
  const prev = useRef(null)

  useEffect(() => {
    if (!selectedId || selectedId === prev.current) return
    prev.current = selectedId
    if (skipRef.current) { skipRef.current = false; return }
    const inc = incidents.find(i => i.id === selectedId)
    if (!inc || !Number.isFinite(inc.latitude)) return
    map.flyTo([inc.latitude, inc.longitude], Math.max(map.getZoom(), 18), { duration: 0.7 })
  }, [selectedId, incidents, map, skipRef])

  return null
}

/** Keeps Leaflet's canvas correct when the surrounding panes resize. */
function ResizeHandler() {
  const map = useMap()
  useEffect(() => {
    const fix = () => map.invalidateSize()
    const t = setTimeout(fix, 200)
    window.addEventListener('resize', fix)
    return () => { clearTimeout(t); window.removeEventListener('resize', fix) }
  }, [map])
  return null
}

/** Reports zoom upward so the shell can label the current view mode. */
function ZoomReporter({ onZoom }) {
  const map = useMap()
  useEffect(() => { onZoom(map.getZoom()) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useMapEvents({ zoomend: () => onZoom(map.getZoom()) })
  return null
}

const STATUS_STYLES = {
  pending: { bg: '#fef3c7', color: '#92400e', label: 'Pending' },
  assigned: { bg: '#dbeafe', color: '#1e40af', label: 'Assigned' },
  resolved: { bg: '#d1fae5', color: '#065f46', label: 'Resolved' },
}

export default function IncidentMap({
  incidents = [],
  tanodTrails = {},
  height = '70vh',
  onIncidentClick,
  // ---- command-console props ----
  theme = 'light',        // 'light' | 'dark'
  selectedId = null,      // highlight + fly to this incident
  onSelect,               // (id) => void, fired when a pin is clicked
  onFocusGroup,           // (incidents[]) => void, fired when an aggregate is clicked
  overlays = null,        // { coverage, radius } — see MapLayers
}) {
  const validIncidents = useMemo(
    () => incidents.filter(i => Number.isFinite(i.latitude) && Number.isFinite(i.longitude)),
    [incidents]
  )
  const pendingCount = validIncidents.filter(i => i.status === 'pending').length
  const isDark = theme === 'dark'
  const skipFlyRef = useRef(false)
  const [zoom, setZoom] = useState(12)

  const viewMode = zoomModeLabel(zoom)

  const tanodEntries = useMemo(() => {
    return Object.entries(tanodTrails)
      .map(([tanodId, { tanod, points }]) => {
        const valid = (points || []).filter(
          p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)
        )
        if (valid.length === 0) return null
        const latest = valid[valid.length - 1]
        const stale = Date.now() - new Date(latest.recorded_at).getTime() > TANOD_STALE_MS
        return { tanodId, tanod, latest, stale, firstAt: valid[0].recorded_at }
      })
      .filter(Boolean)
  }, [tanodTrails])

  const tanodPositions = useMemo(
    () => tanodEntries.map(e => ({ tanodId: e.tanodId, latitude: e.latest.latitude, longitude: e.latest.longitude })),
    [tanodEntries]
  )

  // Response routes: tanod → their assigned incident(s)
  const routes = useMemo(() => {
    const out = []
    for (const entry of tanodEntries) {
      const from = [entry.latest.latitude, entry.latest.longitude]
      const targets = validIncidents.filter(
        i => i.status === 'assigned' && i.assigned_to === entry.tanodId
      )
      for (const inc of targets) {
        const to = [inc.latitude, inc.longitude]
        out.push({
          key: `route-${entry.tanodId}-${inc.id}`,
          entry,
          incident: inc,
          path: curvedPath(from, to),
          meters: distanceMeters(from, to),
        })
      }
    }
    return out
  }, [tanodEntries, validIncidents])

  const respondingByTanod = useMemo(() => {
    const m = {}
    for (const r of routes) {
      if (!m[r.entry.tanodId]) m[r.entry.tanodId] = []
      m[r.entry.tanodId].push(r)
    }
    return m
  }, [routes])

  const tanodNameById = useMemo(() => {
    const m = {}
    for (const e of tanodEntries) m[e.tanodId] = e.tanod?.full_name
    return m
  }, [tanodEntries])

  const defaultCenter = [14.5995, 120.9842]
  const mapIsEmpty = validIncidents.length === 0 && tanodEntries.length === 0

  return (
    <div className={`relative overflow-hidden ${isDark ? 'imap-dark' : ''}`}
      style={{
        border: `1px solid ${isDark ? '#242938' : '#f0effe'}`,
        height,
        boxShadow: isDark ? 'none' : '0 8px 32px rgba(91,84,232,0.08)',
        background: isDark ? '#0f1117' : '#eceafc',
      }}>
      <MapContainer
        center={defaultCenter}
        zoom={12}
        style={{ width: '100%', height: '100%', background: isDark ? '#0f1117' : '#eceafc' }}
        scrollWheelZoom={true}
      >
        <LayersControl position="topright">
          {/* In dark mode the first slot serves CARTO Dark Matter —
              same street detail, night-shift friendly. */}
          <LayersControl.BaseLayer checked name={isDark ? 'Operations' : 'Detailed'}>
            <TileLayer
              key={isDark ? 'dark' : 'osm'}
              attribution={isDark
                ? '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>'
                : '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'}
              url={isDark
                ? 'https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png'
                : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'}
              maxZoom={19}
              detectRetina
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Clean">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              maxZoom={19}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellite">
            <TileLayer
              attribution='Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />
          </LayersControl.BaseLayer>
          <LayersControl.Overlay name="Labels (for Satellite)">
            <TileLayer
              attribution='&copy; CARTO'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png"
              maxZoom={19}
              pane="overlayPane"
            />
          </LayersControl.Overlay>
        </LayersControl>

        <FitBounds incidents={validIncidents} tanodPositions={tanodPositions} />
        <FlyToSelected incidents={validIncidents} selectedId={selectedId} skipRef={skipFlyRef} />
        <ResizeHandler />
        <ZoomReporter onZoom={setZoom} />

        {/* Optional overlays. Note there is no heatmap toggle any more —
            density is now what the map shows automatically when zoomed out,
            rather than something the user has to know to switch on. */}
        {overlays?.coverage && (
          <CoverageLayer
            trailPoints={overlays.coverage.trailPoints}
            incidents={overlays.coverage.incidents}
            lookbackHours={overlays.coverage.lookbackHours ?? 6}
          />
        )}
        {overlays?.radius && (
          <RadiusTool
            active
            radius={overlays.radius.radius ?? 200}
            incidents={overlays.radius.incidents}
            tanodPositions={overlays.radius.tanodPositions}
            onResult={overlays.radius.onResult}
          />
        )}

        {/* Response routes: white casing + animated orange dashes */}
        {routes.map(r => (
          <Polyline
            key={`${r.key}-casing`}
            positions={r.path}
            pathOptions={{ color: isDark ? '#0f1117' : '#ffffff', weight: 7, opacity: 0.9, lineCap: 'round' }}
          />
        ))}
        {routes.map(r => (
          <Polyline
            key={r.key}
            positions={r.path}
            pathOptions={{
              color: '#f97316',
              weight: 4,
              opacity: 0.9,
              dashArray: '10 12',
              lineCap: 'round',
              className: 'route-line',
            }}
          >
            <Tooltip sticky>
              🛡️ {r.entry.tanod?.full_name?.split(' ')[0] || 'Tanod'} → {r.incident.title} · {fmtDist(r.meters)} away
            </Tooltip>
          </Polyline>
        ))}

        {/* Tanod current positions */}
        {tanodEntries.map(entry => (
          <Marker
            key={`tanod-${entry.tanodId}`}
            position={[entry.latest.latitude, entry.latest.longitude]}
            icon={getTanodIcon(entry.stale, entry.tanod?.avatar_url, entry.tanod?.full_name?.[0]?.toUpperCase())}
            zIndexOffset={2000}
            alt={`Tanod: ${entry.tanod?.full_name || 'Unknown'}`}
          >
            <Popup>
              <div style={{ minWidth: '210px', padding: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '8px',
                    background: entry.stale ? '#fef3c7' : '#d1fae5',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '16px', flexShrink: 0, overflow: 'hidden',
                  }}>
                    {entry.tanod?.avatar_url
                      ? <img src={entry.tanod.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : '🛡️'}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: '13px', margin: 0 }}>
                      {entry.tanod?.full_name || 'Tanod'}
                    </p>
                    <p style={{
                      fontSize: '10px', fontWeight: 700, margin: 0,
                      textTransform: 'uppercase', letterSpacing: '0.5px',
                      color: entry.stale ? '#b45309'
                        : (respondingByTanod[entry.tanodId] ? '#c2410c' : '#059669'),
                    }}>
                      {entry.stale ? 'On duty · signal lost'
                        : (respondingByTanod[entry.tanodId] ? 'Responding' : 'On duty · available')}
                    </p>
                  </div>
                </div>

                {respondingByTanod[entry.tanodId]?.map(r => (
                  <div key={r.key} style={{
                    fontSize: '11px', color: '#9a3412', background: '#fff7ed',
                    border: '1px solid #fed7aa', borderRadius: '8px',
                    padding: '5px 8px', marginBottom: '6px',
                  }}>
                    ➜ {r.incident.title} · <b>{fmtDist(r.meters)}</b> away
                  </div>
                ))}

                <div style={{ fontSize: '11px', color: '#6b7280', lineHeight: 1.7 }}>
                  <div title={fullDate(entry.latest.recorded_at)}>
                    📍 Position updated {timeAgo(entry.latest.recorded_at)}
                  </div>
                  <div>🚶 Patrolling since {timeAgo(entry.firstAt)}</div>
                  {Number.isFinite(entry.latest.accuracy) && (
                    <div>🎯 Accuracy ±{Math.round(entry.latest.accuracy)}m</div>
                  )}
                </div>

                {entry.stale && (
                  <p style={{
                    fontSize: '10px', color: '#92400e', background: '#fef3c7',
                    padding: '4px 8px', borderRadius: '8px', marginTop: '8px',
                  }}>
                    No updates for a while — phone may be locked. Consider calling.
                  </p>
                )}

                {entry.tanod?.phone && (
                  <a href={`tel:${entry.tanod.phone}`}
                    style={{
                      display: 'block', textAlign: 'center', textDecoration: 'none',
                      width: '100%', marginTop: '10px', padding: '8px',
                      background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                      color: 'white', border: 'none', borderRadius: '8px',
                      fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                    }}>
                    📞 Call {entry.tanod.full_name?.split(' ')[0] || 'tanod'}
                  </a>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Incidents. The layer picks its own representation from the zoom:
            density surface → area bins → clusters → individual pins, so
            markers never overlap at any scale, and no "expand this pile"
            interaction state exists to be invalidated by panning. */}
        <IncidentLayer
          incidents={validIncidents}
          onFocusGroup={onFocusGroup}
          renderPin={(inc, latlngOverride) => {
            const cat = categoryConfig[inc.category] || categoryConfig.Other
            const status = STATUS_STYLES[inc.status] || STATUS_STYLES.pending
            const prio = PRIORITY_STYLES[inc.priority]
            const assignedName = inc.assigned_to ? tanodNameById[inc.assigned_to] : null
            const isSel = inc.id === selectedId
            return (
              <Marker
                key={inc.id}
                position={latlngOverride || [inc.latitude, inc.longitude]}
                icon={getIcon(inc.category, inc.status, inc.priority)}
                zIndexOffset={isSel ? 1500 : inc.status === 'pending' ? 1000 : inc.status === 'assigned' ? 500 : 0}
                alt={`${inc.category}: ${inc.title}`}
                eventHandlers={{ click: () => { skipFlyRef.current = true; onSelect?.(inc.id) } }}
              >
                <Popup>
                  <div style={{ minWidth: '230px', padding: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '8px',
                        background: cat.color + '20',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '16px', flexShrink: 0,
                      }}>
                        {cat.emoji}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ fontWeight: 700, fontSize: '13px', margin: 0 }}>{inc.title}</p>
                        <p style={{ fontSize: '10px', color: cat.color, fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{inc.category}</p>
                      </div>
                      {prio && (
                        <span style={{
                          fontSize: '9px', fontWeight: 800,
                          padding: '2px 7px', borderRadius: '20px',
                          background: prio.bg, color: prio.color,
                          textTransform: 'uppercase', flexShrink: 0,
                        }}>
                          {inc.priority}
                        </span>
                      )}
                    </div>

                    {inc.description && (
                      <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0', lineHeight: 1.5 }}>
                        {inc.description.slice(0, 100)}{inc.description.length > 100 ? '…' : ''}
                      </p>
                    )}

                    <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '8px', lineHeight: 1.7 }}>
                      <div>📍 {inc.location}</div>
                      {inc.profiles?.full_name && <div>🧑 Reported by {inc.profiles.full_name}</div>}
                      {assignedName && <div>🛡️ Assigned to {assignedName}</div>}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #f0effe' }}>
                      <span style={{
                        fontSize: '10px', fontWeight: 700,
                        padding: '2px 8px', borderRadius: '20px',
                        background: status.bg, color: status.color,
                        textTransform: 'uppercase',
                      }}>
                        {inc.status}
                      </span>
                      <span style={{ fontSize: '10px', color: '#9ca3af' }} title={fullDate(inc.created_at)}>
                        {timeAgo(inc.created_at)}
                      </span>
                    </div>

                    {onIncidentClick && (
                      <button onClick={() => onIncidentClick(inc)}
                        style={{
                          width: '100%', marginTop: '10px', padding: '8px',
                          background: 'linear-gradient(135deg, #5B54E8, #7C75F0)',
                          color: 'white', border: 'none', borderRadius: '8px',
                          fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                        }}>
                        View Details →
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>
            )
          }}
        />
      </MapContainer>

      {/* Count chip */}
      {!mapIsEmpty && (
        <div className="absolute top-3 left-3 px-3 py-1.5 rounded-xl text-[11px] font-bold z-[1000] flex items-center gap-1.5"
          style={{
            background: isDark ? 'rgba(28,32,48,0.95)' : 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(6px)',
            color: isDark ? '#8b85ff' : '#5B54E8',
            boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
          }}>
          <MapPin size={11} />
          {validIncidents.length} incident{validIncidents.length === 1 ? '' : 's'}
          {pendingCount > 0 && (
            <span style={{ color: '#92400e', background: '#fef3c7', padding: '1px 6px', borderRadius: '10px' }}>
              {pendingCount} pending
            </span>
          )}
          {tanodEntries.length > 0 && (
            <span style={{ color: '#065f46', background: '#d1fae5', padding: '1px 6px', borderRadius: '10px' }}>
              🛡️ {tanodEntries.length} on duty
            </span>
          )}
          {routes.length > 0 && (
            <span style={{ color: '#c2410c', background: '#fff7ed', padding: '1px 6px', borderRadius: '10px' }}>
              🚨 {routes.length} responding
            </span>
          )}
        </div>
      )}

      {/* View-mode chip. Without this the map silently changes what it draws
          as you zoom, which reads as a glitch rather than a feature. */}
      {!mapIsEmpty && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-xl z-[1000] flex items-center gap-1.5 whitespace-nowrap"
          style={{
            background: isDark ? 'rgba(28,32,48,0.95)' : 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(6px)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
          }}>
          <LayersIcon size={11} style={{ color: isDark ? '#8b85ff' : '#5B54E8' }} />
          <span className="text-[11px] font-bold" style={{ color: isDark ? '#e8eaf2' : '#374151' }}>
            {viewMode.label}
          </span>
          {viewMode.hint && (
            <span className="text-[10px] hidden sm:inline" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>
              · {viewMode.hint}
            </span>
          )}
        </div>
      )}

      {/* Status legend */}
      <div className="absolute bottom-3 left-3 px-3 py-2 rounded-xl z-[1000] flex items-center gap-3 flex-wrap"
        style={{
          background: isDark ? 'rgba(28,32,48,0.92)' : 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(6px)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
          maxWidth: 'calc(100% - 24px)',
        }}>
        {[
          ['#f97316', 'Pending', true],
          ['#3b82f6', 'Assigned', false],
          ['#22c55e', 'Resolved', false],
        ].map(([color, label, glow]) => (
          <span key={label} className="flex items-center gap-1.5 text-[10px] font-bold"
            style={{ color: isDark ? '#9aa3b8' : '#6b7280' }}>
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: color, boxShadow: glow ? `0 0 0 3px ${color}40` : 'none', opacity: label === 'Resolved' ? 0.6 : 1 }} />
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: isDark ? '#9aa3b8' : '#6b7280' }}>
          <span className="text-[11px]" aria-hidden="true">🛡️</span> Tanod
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: isDark ? '#9aa3b8' : '#6b7280' }}>
          <span className="flex-shrink-0" style={{ width: '18px', borderTop: '3px dashed #f97316' }} /> En route
        </span>
        {overlays?.coverage && (
          <span className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: isDark ? '#9aa3b8' : '#6b7280' }}>
            <span className="w-2.5 h-2.5 flex-shrink-0" style={{ background: '#dc262633', border: '1px solid #dc262666' }} /> Unpatrolled
          </span>
        )}
      </div>

      {/* Empty state */}
      {mapIsEmpty && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center pointer-events-none">
          <div className="px-5 py-4 rounded-2xl text-center pointer-events-auto"
            style={{
              background: isDark ? 'rgba(28,32,48,0.95)' : 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(6px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
            }}>
            <MapPin size={22} className="mx-auto mb-1.5" style={{ color: isDark ? '#4b5563' : '#d1d5db' }} />
            <p className="text-sm font-bold" style={{ color: isDark ? '#e8eaf2' : '#374151' }}>Nothing to show yet</p>
            <p className="text-xs mt-0.5" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>
              Incidents and on-duty tanods will appear here
            </p>
          </div>
        </div>
      )}
    </div>
  )
}