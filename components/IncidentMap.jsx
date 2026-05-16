'use client'
import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

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

function createIcon(category, status) {
  const cat = categoryConfig[category] || categoryConfig.Other
  const isPending = status === 'pending'

  return L.divIcon({
    className: 'incident-marker',
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center;">
        ${isPending ? `<div style="
          position: absolute;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: ${cat.color}40;
          animation: pulse-ring 2s infinite;
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
      </div>
      <style>
        @keyframes pulse-ring {
          0% { transform: scale(0.8); opacity: 0.8; }
          50% { transform: scale(1.5); opacity: 0.2; }
          100% { transform: scale(0.8); opacity: 0.8; }
        }
      </style>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })
}

function FitBounds({ incidents }) {
  const map = useMap()
  useEffect(() => {
    if (incidents.length === 0) return
    const valid = incidents.filter(i => i.latitude && i.longitude)
    if (valid.length === 0) return
    if (valid.length === 1) {
      map.setView([valid[0].latitude, valid[0].longitude], 16)
    } else {
      const bounds = L.latLngBounds(valid.map(i => [i.latitude, i.longitude]))
      map.fitBounds(bounds, { padding: [50, 50] })
    }
  }, [incidents, map])
  return null
}

export default function IncidentMap({ incidents, height = '70vh', onIncidentClick }) {
  const validIncidents = incidents.filter(i => i.latitude && i.longitude)
  const defaultCenter = [14.5995, 120.9842]

  return (
    <div className="rounded-3xl overflow-hidden" style={{border: '1px solid #f0effe', height, boxShadow: '0 8px 32px rgba(91,84,232,0.08)'}}>
      <MapContainer
        center={defaultCenter}
        zoom={12}
        style={{ width: '100%', height: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds incidents={validIncidents} />

        {validIncidents.map(inc => {
          const cat = categoryConfig[inc.category] || categoryConfig.Other
          return (
            <Marker
              key={inc.id}
              position={[inc.latitude, inc.longitude]}
              icon={createIcon(inc.category, inc.status)}
            >
              <Popup>
                <div style={{minWidth: '220px', padding: '4px', fontFamily: 'Sora, sans-serif'}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px'}}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '8px',
                      background: cat.color + '20',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '16px',
                    }}>
                      {cat.emoji}
                    </div>
                    <div>
                      <p style={{fontWeight: 700, fontSize: '13px', color: '#1f2937', margin: 0}}>{inc.title}</p>
                      <p style={{fontSize: '10px', color: cat.color, fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px'}}>{inc.category}</p>
                    </div>
                  </div>

                  <p style={{fontSize: '12px', color: '#6b7280', margin: '4px 0', lineHeight: 1.5}}>
                    {inc.description?.slice(0, 100)}{inc.description?.length > 100 ? '...' : ''}
                  </p>

                  <div style={{fontSize: '11px', color: '#9ca3af', marginTop: '8px'}}>
                    📍 {inc.location}
                  </div>

                  <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #f0effe'}}>
                    <span style={{
                      fontSize: '10px', fontWeight: 700,
                      padding: '2px 8px', borderRadius: '20px',
                      background: inc.status === 'pending' ? '#fef3c7' : inc.status === 'assigned' ? '#dbeafe' : '#d1fae5',
                      color: inc.status === 'pending' ? '#92400e' : inc.status === 'assigned' ? '#1e40af' : '#065f46',
                      textTransform: 'uppercase',
                    }}>
                      {inc.status}
                    </span>
                    <span style={{fontSize: '10px', color: '#9ca3af'}}>
                      {new Date(inc.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
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
    </div>
  )
}