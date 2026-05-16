'use client'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const customIcon = L.divIcon({
  className: 'mini-marker',
  html: `
    <div style="position: relative; display: flex; align-items: center; justify-content: center;">
      <div style="
        position: absolute;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        background: rgba(239, 68, 68, 0.3);
        animation: minipulse 2s infinite;
      "></div>
      <div style="
        width: 22px;
        height: 22px;
        background: linear-gradient(135deg, #ef4444, #dc2626);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(239, 68, 68, 0.6);
        border: 2px solid white;
        font-size: 11px;
      ">📍</div>
    </div>
    <style>
      @keyframes minipulse {
        0% { transform: scale(0.8); opacity: 0.8; }
        50% { transform: scale(1.4); opacity: 0.2; }
        100% { transform: scale(0.8); opacity: 0.8; }
      }
    </style>
  `,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
})

export default function MiniMap({ lat, lng, height = 140 }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{border: '1px solid #f0effe', height}}>
      <MapContainer
        center={[lat, lng]}
        zoom={16}
        style={{ width: '100%', height: '100%' }}
        scrollWheelZoom={false}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[lat, lng]} icon={customIcon} />
      </MapContainer>
    </div>
  )
}