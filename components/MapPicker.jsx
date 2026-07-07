'use client'
// NOTE: Leaflet touches `window` at import time — load this with SSR disabled:
//   const MapPicker = dynamic(() => import('@/components/MapPicker'), { ssr: false })
import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Inject keyframes once per page instead of once per marker render.
// Uses the same style-tag id as MiniMap-style components can share.
if (typeof document !== 'undefined' && !document.getElementById('map-picker-styles')) {
  const style = document.createElement('style')
  style.id = 'map-picker-styles'
  style.textContent = `
    @keyframes pickerpulse {
      0% { transform: scale(0.6); opacity: 0.7; }
      70% { transform: scale(1.5); opacity: 0; }
      100% { transform: scale(0.6); opacity: 0; }
    }
  `
  document.head.appendChild(style)
}

// SVG pin instead of an emoji — the 📍 glyph renders differently on every
// OS. Same teardrop as MiniMap, in brand purple, with a grab-friendly size.
const customIcon = L.divIcon({
  className: 'custom-marker',
  html: `
    <div style="position: relative; width: 36px; height: 48px;">
      <div style="
        position: absolute;
        left: 6px;
        bottom: -2px;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: rgba(91, 84, 232, 0.3);
        animation: pickerpulse 2s ease-out infinite;
      "></div>
      <svg width="36" height="48" viewBox="0 0 36 48" style="position: relative; filter: drop-shadow(0 4px 8px rgba(91,84,232,0.45));">
        <defs>
          <linearGradient id="pickerPinGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#5B54E8"/>
            <stop offset="100%" stop-color="#7C75F0"/>
          </linearGradient>
        </defs>
        <path d="M18 0C8.6 0 1 7.6 1 17c0 12.7 17 31 17 31s17-18.3 17-31C35 7.6 27.4 0 18 0z"
          fill="url(#pickerPinGrad)" stroke="white" stroke-width="3"/>
        <circle cx="18" cy="17" r="6" fill="white"/>
      </svg>
    </div>
  `,
  iconSize: [36, 48],
  iconAnchor: [18, 48], // pin tip sits exactly on the coordinate
})

function MapClickHandler({ setCoords, fromUserRef }) {
  useMapEvents({
    click(e) {
      // Mark this update as user-driven so FlyToLocation leaves the
      // viewport alone — flying + resetting zoom on every tap made
      // fine-tuning maddening (the map moved under your finger).
      fromUserRef.current = true
      setCoords({ lat: e.latlng.lat, lng: e.latlng.lng, accuracy: null })
    },
  })
  return null
}

function FlyToLocation({ coords, fromUserRef }) {
  const map = useMap()
  useEffect(() => {
    if (!coords) return
    if (fromUserRef.current) {
      // User tapped or dragged — they're already looking at the spot.
      fromUserRef.current = false
      return
    }
    // Programmatic update (e.g. GPS locate): fly there, zooming out
    // enough to show the whole accuracy circle when accuracy is poor.
    const zoom = coords.accuracy && coords.accuracy > 1000 ? 13 :
                 coords.accuracy && coords.accuracy > 200 ? 15 : 16
    map.flyTo([coords.lat, coords.lng], zoom, { duration: 1 })
  }, [coords, map, fromUserRef])
  return null
}

export default function MapPicker({ coords, setCoords, height = 280 }) {
  const fromUserRef = useRef(false)

  // Treat malformed coordinates as "not set" instead of crashing Leaflet.
  const validCoords = coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)
    ? coords
    : null

  const defaultCenter = validCoords ? [validCoords.lat, validCoords.lng] : [14.5995, 120.9842]

  return (
    // `relative` was missing — the hint overlay is absolutely positioned,
    // so it was anchoring to some ancestor element instead of this map.
    <div className="relative rounded-2xl overflow-hidden"
      style={{ border: '2px solid #e8e3ff', height, background: '#eceafc' }}>
      <MapContainer
        center={defaultCenter}
        zoom={validCoords ? 16 : 12}
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
        <MapClickHandler setCoords={setCoords} fromUserRef={fromUserRef} />
        <FlyToLocation coords={validCoords} fromUserRef={fromUserRef} />

        {/* Accuracy circle */}
        {validCoords?.accuracy && validCoords.accuracy > 30 && (
          <Circle
            center={[validCoords.lat, validCoords.lng]}
            radius={validCoords.accuracy}
            pathOptions={{
              fillColor: '#5B54E8',
              fillOpacity: 0.15,
              color: '#5B54E8',
              weight: 2,
              opacity: 0.5,
              dashArray: '5, 5',
            }}
          />
        )}

        {validCoords && (
          <Marker
            position={[validCoords.lat, validCoords.lng]}
            icon={customIcon}
            // Dragging the pin is much easier than tap-tap-tapping to
            // fine-tune, especially on a phone.
            draggable
            eventHandlers={{
              dragend(e) {
                const { lat, lng } = e.target.getLatLng()
                fromUserRef.current = true
                setCoords({ lat, lng, accuracy: null })
              },
            }}
          />
        )}
      </MapContainer>

      {/* Hint overlay */}
      {!validCoords ? (
        <div className="absolute bottom-2 left-2 right-2 mx-auto max-w-xs px-3 py-2 rounded-xl text-[10px] text-center font-bold fade-up z-[1000]"
          style={{
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid #e8e3ff',
            color: '#5B54E8',
            boxShadow: '0 4px 16px rgba(91,84,232,0.2)',
          }}>
          👆 Tap the map to set the location
        </div>
      ) : validCoords.accuracy && validCoords.accuracy > 100 ? (
        <div className="absolute bottom-2 left-2 right-2 mx-auto max-w-xs px-3 py-2 rounded-xl text-[10px] text-center font-bold fade-up z-[1000]"
          style={{
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid #e8e3ff',
            color: '#5B54E8',
            boxShadow: '0 4px 16px rgba(91,84,232,0.2)',
          }}>
          💡 Tap the map or drag the pin to fine-tune your exact location
        </div>
      ) : null}
    </div>
  )
}