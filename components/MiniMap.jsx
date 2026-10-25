'use client'
// MapLibre needs the browser — load this with SSR disabled:
//   const MiniMap = dynamic(() => import('@/components/MiniMap'), { ssr: false })
import { Marker } from 'react-map-gl/maplibre'
import { MapPin, Navigation } from 'lucide-react'
import BaseMap from '@/components/map/BaseMap'

// The same teardrop as the console, in alert red, tip on the coordinate.
function Pin() {
  return (
    <svg width="30" height="40" viewBox="0 0 30 40" aria-hidden="true" style={{ display: 'block', filter: 'drop-shadow(0 3px 6px rgba(220,38,38,.45))' }}>
      <path d="M15 0C7.3 0 1 6.3 1 14c0 10.5 14 25 14 25s14-14.5 14-25C29 6.3 22.7 0 15 0z" fill="#dc2626" stroke="#fff" strokeWidth="2" />
      <circle cx="15" cy="14" r="5" fill="#fff" />
    </svg>
  )
}

/**
 * A fixed preview of one location. It cannot be panned or zoomed, so it
 * never fights the page scroll on a phone; "Directions" is the action.
 */
export default function MiniMap({ lat, lng, height = 140, label = 'incident location' }) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return (
      <div className="rounded-2xl flex flex-col items-center justify-center gap-1"
        style={{ border: '1px solid #f0effe', background: '#fafaff', height }}>
        <MapPin size={18} className="text-gray-400" aria-hidden="true" />
        <p className="text-xs text-gray-500">Location unavailable</p>
      </div>
    )
  }

  return (
    <div className="relative rounded-2xl overflow-hidden" style={{ border: '1px solid #f0effe', height, background: '#eceafc' }}>
      {/* Controlled view: when the same card shows a different incident, the map follows. */}
      <BaseMap interactive={false} latitude={lat} longitude={lng} zoom={16}>
        <Marker longitude={lng} latitude={lat} anchor="bottom">
          <Pin />
        </Marker>
      </BaseMap>
      <a
        href={`https://www.google.com/maps?q=${lat},${lng}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Get directions to ${label}`}
        className="absolute top-2 right-2 flex items-center gap-1 px-3 rounded-xl text-xs font-bold"
        style={{ zIndex: 2, minHeight: 36, background: 'rgba(255,255,255,0.95)', color: '#4A43D4', boxShadow: '0 2px 8px rgba(91,84,232,0.2)' }}>
        <Navigation size={12} aria-hidden="true" /> Directions
      </a>
    </div>
  )
}
