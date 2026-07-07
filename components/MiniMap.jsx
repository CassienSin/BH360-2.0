'use client'
// NOTE: Leaflet touches `window` at import time, so wherever you use this
// component it must be loaded with SSR disabled:
//   const MiniMap = dynamic(() => import('@/components/MiniMap'), { ssr: false })
import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin, Navigation } from 'lucide-react'

// Inject the pulse keyframes once per page instead of once per marker —
// previously every MiniMap instance shipped its own duplicate <style> tag.
if (typeof document !== 'undefined' && !document.getElementById('mini-marker-styles')) {
  const style = document.createElement('style')
  style.id = 'mini-marker-styles'
  style.textContent = `
    @keyframes minipulse {
      0% { transform: scale(0.6); opacity: 0.7; }
      70% { transform: scale(1.6); opacity: 0; }
      100% { transform: scale(0.6); opacity: 0; }
    }
  `
  document.head.appendChild(style)
}

// A proper teardrop pin instead of an emoji in a circle — emoji render
// differently on every OS, an SVG looks identical everywhere.
const customIcon = L.divIcon({
  className: 'mini-marker',
  html: `
    <div style="position: relative; width: 30px; height: 40px;">
      <div style="
        position: absolute;
        left: 5px;
        bottom: 0;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: rgba(239, 68, 68, 0.35);
        animation: minipulse 2s ease-out infinite;
        transform-origin: center;
      "></div>
      <svg width="30" height="40" viewBox="0 0 30 40" style="position: relative; filter: drop-shadow(0 3px 6px rgba(239,68,68,0.45));">
        <defs>
          <linearGradient id="pinGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#ef4444"/>
            <stop offset="100%" stop-color="#dc2626"/>
          </linearGradient>
        </defs>
        <path d="M15 0C7.3 0 1 6.3 1 14c0 10.5 14 25 14 25s14-14.5 14-25C29 6.3 22.7 0 15 0z"
          fill="url(#pinGrad)" stroke="white" stroke-width="2"/>
        <circle cx="15" cy="14" r="5" fill="white"/>
      </svg>
    </div>
  `,
  iconSize: [30, 40],
  iconAnchor: [15, 40], // tip of the pin sits exactly on the coordinate
})

// MapContainer only reads `center` on mount — if lat/lng props change
// (e.g. the same card re-used for a different incident) the map used to
// keep showing the old location. This keeps it in sync.
function Recenter({ lat, lng }) {
  const map = useMap()
  useEffect(() => {
    map.setView([lat, lng])
  }, [lat, lng, map])
  return null
}

export default function MiniMap({ lat, lng, height = 140, label = 'incident location' }) {
  // Invalid coordinates previously crashed the whole page inside Leaflet.
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return (
      <div className="rounded-2xl flex flex-col items-center justify-center gap-1"
        style={{ border: '1px solid #f0effe', background: '#fafaff', height }}>
        <MapPin size={18} className="text-gray-300" />
        <p className="text-xs text-gray-400">Location unavailable</p>
      </div>
    )
  }

  return (
    <div className="relative rounded-2xl overflow-hidden"
      style={{ border: '1px solid #f0effe', height, background: '#eceafc' }}>
      <MapContainer
        center={[lat, lng]}
        zoom={16}
        style={{ width: '100%', height: '100%', background: '#eceafc' }}
        // Fully static preview: no accidental pans/zooms while scrolling
        // the page on mobile. Tapping "Directions" is the interaction.
        scrollWheelZoom={false}
        dragging={false}
        touchZoom={false}
        doubleClickZoom={false}
        boxZoom={false}
        keyboard={false}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          // The {s}. subdomains are deprecated by OSM; single host is current.
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
          detectRetina
        />
        <Marker position={[lat, lng]} icon={customIcon} alt={label} />
        <Recenter lat={lat} lng={lng} />
      </MapContainer>

      {/* Directions — opens the native maps app on mobile */}
      <a
        href={`https://www.google.com/maps?q=${lat},${lng}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Get directions to ${label}`}
        className="absolute top-2 right-2 flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all hover:scale-105"
        style={{
          zIndex: 1000,
          background: 'rgba(255,255,255,0.95)',
          color: '#5B54E8',
          boxShadow: '0 2px 8px rgba(91,84,232,0.2)',
          backdropFilter: 'blur(4px)',
        }}>
        <Navigation size={11} /> Directions
      </a>

      {/* OSM's tile usage policy requires attribution — keep it, just small */}
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-1 right-2 text-[9px] text-gray-500 hover:text-gray-700"
        style={{ zIndex: 1000, background: 'rgba(255,255,255,0.75)', padding: '1px 4px', borderRadius: '4px' }}>
        © OpenStreetMap
      </a>
    </div>
  )
}