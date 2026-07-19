'use client'
// NOTE: Leaflet touches `window` at import time — load this with SSR disabled:
//   const IncidentMap = dynamic(() => import('@/components/IncidentMap'), { ssr: false })
import { useEffect, useRef, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin } from 'lucide-react'
import { timeAgo, fullDate } from '@/lib/timeAgo'
import { CATEGORY_CONFIG as categoryConfig } from '@/lib/incident-config'

// Inject the pulse keyframes ONCE per page. Previously every single marker
// carried its own duplicate <style> tag inside its HTML.
if (typeof document !== 'undefined' && !document.getElementById('incident-map-styles')) {
  const style = document.createElement('style')
  style.id = 'incident-map-styles'
  style.textContent = `
    @keyframes pulse-ring {
      0% { transform: scale(0.7); opacity: 0.7; }
      70% { transform: scale(1.6); opacity: 0; }
      100% { transform: scale(0.7); opacity: 0; }
    }
  `
  document.head.appendChild(style)
}

// Icons are cached by category+status. createIcon used to run for every
// marker on every render, building fresh L.divIcon objects each time —
// which made react-leaflet tear down and rebuild every marker's DOM.
// There are only ~36 possible combinations, so cache them forever.
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
          ${cat.icon}
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

function FitBounds({ incidents }) {
  const map = useMap()
  // Only refit when the SET of incidents actually changes. Previously any
  // parent re-render (new array identity — constant with realtime updates)
  // snapped the viewport back, fighting the user's panning and zooming.
  const prevSignature = useRef('')

  useEffect(() => {
    if (incidents.length === 0) return
    const signature = incidents.map(i => i.id).sort().join(',')
    if (signature === prevSignature.current) return
    prevSignature.current = signature

    if (incidents.length === 1) {
      map.setView([incidents[0].latitude, incidents[0].longitude], 16)
    } else {
      const bounds = L.latLngBounds(incidents.map(i => [i.latitude, i.longitude]))
      // maxZoom stops a tight cluster from over-zooming to rooftop level
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 })
    }
  }, [incidents, map])
  return null
}

const STATUS_STYLES = {
  pending: { bg: '#fef3c7', color: '#92400e', label: 'Pending' },
  assigned: { bg: '#dbeafe', color: '#1e40af', label: 'Assigned' },
  resolved: { bg: '#d1fae5', color: '#065f46', label: 'Resolved' },
}

export default function IncidentMap({ incidents = [], height = '70vh', onIncidentClick }) {
  // Number.isFinite catches NaN/strings/nulls; the old truthy check also
  // wrongly discarded legitimate 0 coordinates.
  const validIncidents = useMemo(
    () => incidents.filter(i => Number.isFinite(i.latitude) && Number.isFinite(i.longitude)),
    [incidents]
  )
  const pendingCount = validIncidents.filter(i => i.status === 'pending').length
  const defaultCenter = [14.5995, 120.9842]

  return (
    <div className="relative rounded-3xl overflow-hidden"
      style={{ border: '1px solid #f0effe', height, boxShadow: '0 8px 32px rgba(91,84,232,0.08)', background: '#eceafc' }}>
      <MapContainer
        center={defaultCenter}
        zoom={12}
        style={{ width: '100%', height: '100%', background: '#eceafc' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
          // The {s}. subdomains are deprecated by OSM; single host is current.
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
          detectRetina
        />
        <FitBounds incidents={validIncidents} />

        {validIncidents.map(inc => {
          const cat = categoryConfig[inc.category] || categoryConfig.Other
          const status = STATUS_STYLES[inc.status] || STATUS_STYLES.pending
          return (
            <Marker
              key={inc.id}
              position={[inc.latitude, inc.longitude]}
              icon={getIcon(inc.category, inc.status)}
              // Active incidents stack above resolved ones where they overlap
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
                      {cat.icon}
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

      {/* Incident count chip */}
      {validIncidents.length > 0 && (
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
        </div>
      )}

      {/* Status legend */}
      <div className="absolute bottom-3 left-3 px-3 py-2 rounded-xl z-[1000] flex items-center gap-3"
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
      </div>

      {/* Empty state */}
      {validIncidents.length === 0 && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center pointer-events-none">
          <div className="px-5 py-4 rounded-2xl text-center pointer-events-auto"
            style={{
              background: 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(6px)',
              boxShadow: '0 8px 32px rgba(91,84,232,0.2)',
            }}>
            <MapPin size={22} className="mx-auto mb-1.5 text-gray-300" />
            <p className="text-sm font-bold text-gray-700">No incidents to show</p>
            <p className="text-xs text-gray-400 mt-0.5">Incidents with a location will appear here</p>
          </div>
        </div>
      )}
    </div>
  )
}