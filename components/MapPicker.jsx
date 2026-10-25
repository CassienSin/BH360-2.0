'use client'
// MapLibre needs the browser — load this with SSR disabled:
//   const MapPicker = dynamic(() => import('@/components/MapPicker'), { ssr: false })
import { useEffect, useMemo, useRef, useState } from 'react'
import { Marker, Source, Layer } from 'react-map-gl/maplibre'
import BaseMap from '@/components/map/BaseMap'
import { circlePolygon } from '@/lib/mapGeometry'

function Pin() {
  return (
    <svg width="36" height="48" viewBox="0 0 36 48" aria-hidden="true" style={{ display: 'block', cursor: 'grab', filter: 'drop-shadow(0 4px 8px rgba(91,84,232,.45))' }}>
      <path d="M18 0C8.6 0 1 7.6 1 17c0 12.7 17 31 17 31s17-18.3 17-31C35 7.6 27.4 0 18 0z" fill="#5B54E8" stroke="#fff" strokeWidth="3" />
      <circle cx="18" cy="17" r="6" fill="#fff" />
    </svg>
  )
}

const hintStyle = {
  zIndex: 2, background: 'rgba(255,255,255,0.96)', border: '1px solid #e8e3ff',
  color: '#4A43D4', boxShadow: '0 4px 16px rgba(91,84,232,0.2)',
}

/**
 * Where did it happen? Tap the map or drag the pin. A GPS fix (set by the
 * report form) flies the map there and shows the accuracy circle; a tap or
 * drag never moves the map under the user's finger.
 */
export default function MapPicker({ coords, setCoords, height = 280 }) {
  const mapRef = useRef(null)
  const fromUserRef = useRef(false)

  const valid = coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng) ? coords : null
  // Read once; after that the map moves by flyTo or by the user, never by re-rendering.
  const [startView] = useState(() => (valid ? { latitude: valid.lat, longitude: valid.lng, zoom: 16 } : null))

  // Plain numbers as dependencies: the coords object is new on every
  // parent render, the values are not.
  const lat = valid?.lat
  const lng = valid?.lng
  const accuracy = valid?.accuracy ?? null

  useEffect(() => {
    if (lat == null) return
    if (fromUserRef.current) { fromUserRef.current = false; return }
    const zoom = accuracy > 1000 ? 13 : accuracy > 200 ? 15 : 16
    mapRef.current?.flyTo({ center: [lng, lat], zoom, duration: 1000 })
  }, [lat, lng, accuracy])

  const accuracyShape = useMemo(() => (lat != null && accuracy > 30 ? {
    type: 'Feature', properties: {},
    geometry: { type: 'Polygon', coordinates: [circlePolygon([lat, lng], accuracy)] },
  } : null), [lat, lng, accuracy])

  return (
    <div className="relative rounded-2xl overflow-hidden" style={{ border: '2px solid #e8e3ff', height, background: '#eceafc' }}>
      <BaseMap
        ref={mapRef}
        initialViewState={startView || undefined}
        cursor="pointer"
        onClick={(e) => {
          if (e.originalEvent?.target?.closest?.('.maplibregl-marker')) return
          fromUserRef.current = true
          setCoords({ lat: e.lngLat.lat, lng: e.lngLat.lng, accuracy: null })
        }}
      >
        {accuracyShape && (
          <Source id="picker-accuracy" type="geojson" data={accuracyShape}>
            <Layer id="picker-accuracy-fill" type="fill" paint={{ 'fill-color': '#5B54E8', 'fill-opacity': 0.15 }} />
            <Layer id="picker-accuracy-line" type="line" paint={{ 'line-color': '#5B54E8', 'line-width': 2, 'line-opacity': 0.5, 'line-dasharray': [2, 2] }} />
          </Source>
        )}
        {valid && (
          <Marker
            longitude={valid.lng}
            latitude={valid.lat}
            anchor="bottom"
            draggable
            onDragEnd={(e) => {
              fromUserRef.current = true
              setCoords({ lat: e.lngLat.lat, lng: e.lngLat.lng, accuracy: null })
            }}
          >
            <Pin />
          </Marker>
        )}
      </BaseMap>

      {!valid ? (
        <div className="absolute top-2 left-2 right-2 mx-auto max-w-xs px-3 py-2 rounded-xl text-xs text-center font-bold" style={hintStyle}>
          Tap the map to set the location
        </div>
      ) : valid.accuracy > 100 ? (
        <div className="absolute top-2 left-2 right-2 mx-auto max-w-xs px-3 py-2 rounded-xl text-xs text-center font-bold" style={hintStyle}>
          Tap the map or drag the pin to fine-tune the exact spot
        </div>
      ) : null}
    </div>
  )
}
