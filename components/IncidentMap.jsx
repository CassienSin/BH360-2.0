'use client'
// NOTE: Leaflet touches `window` at import time — load this with SSR disabled:
//   const IncidentMap = dynamic(() => import('@/components/IncidentMap'), { ssr: false })
import { useEffect, useRef, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip, useMap, LayersControl } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin } from 'lucide-react'
import { timeAgo, fullDate } from '@/lib/timeAgo'

const categoryConfig = {
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

// A tanod is "stale" if their newest point is older than this — likely
// phone locked or app backgrounded. Shown amber instead of green.
const TANOD_STALE_MS = 5 * 60 * 1000

// Inject keyframes ONCE per page: marker pulse + the delivery-app style
// flowing dashes on route lines.
if (typeof document !== 'undefined' && !document.getElementById('incident-map-styles')) {
  const style = document.createElement('style')
  style.id = 'incident-map-styles'
  style.textContent = `
    @keyframes pulse-ring {
      0% { transform: scale(0.7); opacity: 0.7; }
      70% { transform: scale(1.6); opacity: 0; }
      100% { transform: scale(0.7); opacity: 0; }
    }
    @keyframes route-dash {
      to { stroke-dashoffset: -22; }
    }
    .route-line {
      animation: route-dash 1.1s linear infinite;
    }
  `
  document.head.appendChild(style)
}

// ---- Route helpers ----
// Gently curved path between two points (quadratic bezier sampled into
// segments). Delivery-app aesthetic; NOT road routing.
function curvedPath(from, to, curvature = 0.18, segments = 28) {
  const midLat = (from[0] + to[0]) / 2
  const midLng = (from[1] + to[1]) / 2
  const dLat = to[0] - from[0]
  const dLng = to[1] - from[1]
  // control point offset perpendicular to the segment
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

// Icons are cached by category+status. createIcon used to run for every
// marker on every render, building fresh L.divIcon objects each time —
// which made react-leaflet tear down and rebuild every marker's DOM.
const iconCache = new Map()
function getIcon(category, status) {
  const key = `${category}|${status}`
  if (iconCache.has(key)) return iconCache.get(key)

  const cat = categoryConfig[category] || categoryConfig.Other
  const isPending = status === 'pending'
  const isResolved = status === 'resolved'

  const icon = L.divIcon({
    className: 'incident-marker',
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; ${isResolved ? 'opacity: 0.55;' : ''}">
        ${isPending ? `<div style="
          position: absolute;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: ${cat.color}40;
          animation: pulse-ring 2s ease-out infinite;
        "></div>` : ''}
        <div style="
          width: 32px;
          height: 32px;
          background: ${cat.color};
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px ${cat.color}80;
          border: 3px solid white;
          font-size: 14px;
        ">
          ${cat.emoji}
        </div>
        ${isResolved ? `<div style="
          position: absolute;
          top: -3px;
          right: -3px;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #22c55e;
          border: 2px solid white;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 8px;
          font-weight: 900;
        ">✓</div>` : ''}
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
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
          width: 46px;
          height: 46px;
          border-radius: 50%;
          background: ${color}40;
          animation: pulse-ring 2s ease-out infinite;
        "></div>` : ''}
        <div style="
          width: 36px;
          height: 36px;
          background: ${color};
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px ${color}80;
          border: 3px solid ${color};
          overflow: hidden;
          font-size: ${avatarUrl ? '13px' : '16px'};
          color: white;
          font-weight: 800;
          font-family: Sora, sans-serif;
        ">
          ${inner}${avatarUrl ? '' : (initial ? initial : '🛡️')}
        </div>
        <div style="
          position: absolute;
          bottom: -2px;
          right: -2px;
          width: 13px;
          height: 13px;
          border-radius: 50%;
          background: ${color};
          border: 2px solid white;
          display: flex;
          align-items: center;
          justify-content: center;
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
  // Only refit when the SET of things on the map actually changes.
  const prevSignature = useRef('')

  useEffect(() => {
    const allPoints = [
      ...incidents.map(i => [i.latitude, i.longitude]),
      ...tanodPositions.map(t => [t.latitude, t.longitude]),
    ]
    if (allPoints.length === 0) return

    const signature = [
      ...incidents.map(i => `i${i.id}`),
      ...tanodPositions.map(t => `t${t.tanodId}`),
    ].sort().join(',')
    if (signature === prevSignature.current) return
    prevSignature.current = signature

    if (allPoints.length === 1) {
      map.setView(allPoints[0], 16)
    } else {
      const bounds = L.latLngBounds(allPoints)
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 })
    }
  }, [incidents, tanodPositions, map])
  return null
}

const STATUS_STYLES = {
  pending: { bg: '#fef3c7', color: '#92400e', label: 'Pending' },
  assigned: { bg: '#dbeafe', color: '#1e40af', label: 'Assigned' },
  resolved: { bg: '#d1fae5', color: '#065f46', label: 'Resolved' },
}

export default function IncidentMap({ incidents = [], tanodTrails = {}, height = '70vh', onIncidentClick }) {
  const validIncidents = useMemo(
    () => incidents.filter(i => Number.isFinite(i.latitude) && Number.isFinite(i.longitude)),
    [incidents]
  )
  const pendingCount = validIncidents.filter(i => i.status === 'pending').length

  const tanodEntries = useMemo(() => {
    return Object.entries(tanodTrails)
      .map(([tanodId, { tanod, points }]) => {
        const valid = (points || []).filter(
          p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)
        )
        if (valid.length === 0) return null
        const latest = valid[valid.length - 1]
        const stale = Date.now() - new Date(latest.recorded_at).getTime() > TANOD_STALE_MS
        return {
          tanodId,
          tanod,
          latest,
          stale,
          firstAt: valid[0].recorded_at,
        }
      })
      .filter(Boolean)
  }, [tanodTrails])

  const tanodPositions = useMemo(
    () => tanodEntries.map(e => ({ tanodId: e.tanodId, latitude: e.latest.latitude, longitude: e.latest.longitude })),
    [tanodEntries]
  )

  // ---- Delivery-app routes: tanod → their assigned incident(s) ----
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

  // For the tanod popup: what is this tanod responding to?
  const respondingByTanod = useMemo(() => {
    const m = {}
    for (const r of routes) {
      if (!m[r.entry.tanodId]) m[r.entry.tanodId] = []
      m[r.entry.tanodId].push(r)
    }
    return m
  }, [routes])

  const defaultCenter = [14.5995, 120.9842]
  const mapIsEmpty = validIncidents.length === 0 && tanodEntries.length === 0

  return (
    <div className="relative rounded-3xl overflow-hidden"
      style={{ border: '1px solid #f0effe', height, boxShadow: '0 8px 32px rgba(91,84,232,0.08)', background: '#eceafc' }}>
      <MapContainer
        center={defaultCenter}
        zoom={12}
        style={{ width: '100%', height: '100%', background: '#eceafc' }}
        scrollWheelZoom={true}
      >
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Streets">
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
        </LayersControl>

        <FitBounds incidents={validIncidents} tanodPositions={tanodPositions} />

        {/* Response routes: tanod → assigned incident (delivery-app style:
            white casing underneath, animated orange dashes on top) */}
        {routes.map(r => (
          <Polyline
            key={`${r.key}-casing`}
            positions={r.path}
            pathOptions={{ color: '#ffffff', weight: 7, opacity: 0.9, lineCap: 'round' }}
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
              <div style={{ minWidth: '210px', padding: '4px', fontFamily: 'Sora, sans-serif' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '8px',
                    background: entry.stale ? '#fef3c7' : '#d1fae5',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '16px',
                    flexShrink: 0,
                    overflow: 'hidden',
                  }}>
                    {entry.tanod?.avatar_url
                      ? <img src={entry.tanod.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : '🛡️'}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: '13px', color: '#1f2937', margin: 0 }}>
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

                {/* What they're responding to, with live distance */}
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
                  <a
                    href={`tel:${entry.tanod.phone}`}
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

        {validIncidents.map(inc => {
          const cat = categoryConfig[inc.category] || categoryConfig.Other
          const status = STATUS_STYLES[inc.status] || STATUS_STYLES.pending
          return (
            <Marker
              key={inc.id}
              position={[inc.latitude, inc.longitude]}
              icon={getIcon(inc.category, inc.status)}
              zIndexOffset={inc.status === 'pending' ? 1000 : inc.status === 'assigned' ? 500 : 0}
              alt={`${inc.category}: ${inc.title}`}
            >
              <Popup>
                <div style={{ minWidth: '220px', padding: '4px', fontFamily: 'Sora, sans-serif' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '8px',
                      background: cat.color + '20',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '16px',
                      flexShrink: 0,
                    }}>
                      {cat.emoji}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: '13px', color: '#1f2937', margin: 0 }}>{inc.title}</p>
                      <p style={{ fontSize: '10px', color: cat.color, fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{inc.category}</p>
                    </div>
                  </div>

                  {inc.description && (
                    <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0', lineHeight: 1.5 }}>
                      {inc.description.slice(0, 100)}{inc.description.length > 100 ? '…' : ''}
                    </p>
                  )}

                  <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '8px' }}>
                    📍 {inc.location}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #f0effe' }}>
                    <span style={{
                      fontSize: '10px', fontWeight: 700,
                      padding: '2px 8px', borderRadius: '20px',
                      background: status.bg,
                      color: status.color,
                      textTransform: 'uppercase',
                    }}>
                      {inc.status}
                    </span>
                    <span style={{ fontSize: '10px', color: '#9ca3af' }} title={fullDate(inc.created_at)}>
                      {timeAgo(inc.created_at)}
                    </span>
                  </div>

                  {onIncidentClick && (
                    <button
                      onClick={() => onIncidentClick(inc)}
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
        })}
      </MapContainer>

      {/* Count chip */}
      {!mapIsEmpty && (
        <div className="absolute top-3 left-3 px-3 py-1.5 rounded-xl text-[11px] font-bold z-[1000] flex items-center gap-1.5"
          style={{
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(6px)',
            color: '#5B54E8',
            boxShadow: '0 2px 12px rgba(91,84,232,0.2)',
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

      {/* Status legend */}
      <div className="absolute bottom-3 left-3 px-3 py-2 rounded-xl z-[1000] flex items-center gap-3 flex-wrap"
        style={{
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(6px)',
          boxShadow: '0 2px 12px rgba(91,84,232,0.15)',
        }}>
        <span className="flex items-center gap-1.5 text-[10px] font-bold text-gray-600">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: '#f97316', boxShadow: '0 0 0 3px rgba(249,115,22,0.25)' }} />
          Pending
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-bold text-gray-600">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: '#3b82f6' }} />
          Assigned
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-bold text-gray-600">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: '#22c55e', opacity: 0.6 }} />
          Resolved
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-bold text-gray-600">
          <span className="text-[11px]" aria-hidden="true">🛡️</span>
          Tanod
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-bold text-gray-600">
          <span className="flex-shrink-0" style={{ width: '18px', borderTop: '3px dashed #f97316' }} />
          En route
        </span>
      </div>

      {/* Empty state */}
      {mapIsEmpty && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center pointer-events-none">
          <div className="px-5 py-4 rounded-2xl text-center pointer-events-auto"
            style={{
              background: 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(6px)',
              boxShadow: '0 8px 32px rgba(91,84,232,0.2)',
            }}>
            <MapPin size={22} className="mx-auto mb-1.5 text-gray-300" />
            <p className="text-sm font-bold text-gray-700">Nothing to show yet</p>
            <p className="text-xs text-gray-400 mt-0.5">Incidents and on-duty tanods will appear here</p>
          </div>
        </div>
      )}
    </div>
  )
}