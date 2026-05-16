'use client'
import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const customIcon = L.divIcon({
  className: 'custom-marker',
  html: `
    <div style="position: relative; display: flex; align-items: center; justify-content: center;">
      <div style="
        position: absolute;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: rgba(91, 84, 232, 0.2);
        animation: pulse 2s infinite;
      "></div>
      <div style="
        width: 32px;
        height: 40px;
        background: linear-gradient(135deg, #5B54E8, #7C75F0);
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 16px rgba(91, 84, 232, 0.5);
        border: 3px solid white;
      ">
        <div style="transform: rotate(45deg); color: white; font-size: 14px;">📍</div>
      </div>
    </div>
    <style>
      @keyframes pulse {
        0% { transform: scale(1); opacity: 0.8; }
        50% { transform: scale(1.4); opacity: 0.3; }
        100% { transform: scale(1); opacity: 0.8; }
      }
    </style>
  `,
  iconSize: [40, 40],
  iconAnchor: [20, 40],
})

function MapClickHandler({ setCoords }) {
  useMapEvents({
    click(e) {
      // Manual clicks have no accuracy uncertainty
      setCoords({ lat: e.latlng.lat, lng: e.latlng.lng, accuracy: null })
    },
  })
  return null
}

function FlyToLocation({ coords }) {
  const map = useMap()
  useEffect(() => {
    if (coords) {
      // Zoom further if accuracy is low (to show the whole circle)
      const zoom = coords.accuracy && coords.accuracy > 1000 ? 13 :
                   coords.accuracy && coords.accuracy > 200 ? 15 : 16
      map.flyTo([coords.lat, coords.lng], zoom, { duration: 1 })
    }
  }, [coords, map])
  return null
}

export default function MapPicker({ coords, setCoords, height = 280 }) {
  const defaultCenter = coords ? [coords.lat, coords.lng] : [14.5995, 120.9842]

  return (
    <div className="rounded-2xl overflow-hidden" style={{border: '2px solid #e8e3ff', height}}>
      <MapContainer
        center={defaultCenter}
        zoom={coords ? 16 : 12}
        style={{ width: '100%', height: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler setCoords={setCoords} />
        <FlyToLocation coords={coords} />

        {/* Accuracy circle */}
        {coords?.accuracy && coords.accuracy > 30 && (
          <Circle
            center={[coords.lat, coords.lng]}
            radius={coords.accuracy}
            pathOptions={{
              fillColor: '#5B54E8',
              fillOpacity: 0.15,
              color: '#5B54E8',
              weight: 2,
              opacity: 0.5,
              dashArray: '5, 5'
            }}
          />
        )}

        {coords && <Marker position={[coords.lat, coords.lng]} icon={customIcon} />}
      </MapContainer>

      {/* Hint overlay */}
      {coords?.accuracy && coords.accuracy > 100 && (
        <div className="absolute bottom-2 left-2 right-2 mx-auto max-w-xs px-3 py-2 rounded-xl text-[10px] text-center font-bold fade-up z-[1000]"
          style={{
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid #e8e3ff',
            color: '#5B54E8',
            boxShadow: '0 4px 16px rgba(91,84,232,0.2)',
          }}>
          💡 Tap the map to fine-tune your exact location
        </div>
      )}
    </div>
  )
}