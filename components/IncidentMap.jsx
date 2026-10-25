'use client'
// MapLibre needs the browser — load this with SSR disabled:
//   const IncidentMap = dynamic(() => import('@/components/IncidentMap'), { ssr: false })
import { useEffect, useMemo, useRef, useState } from 'react'
import { Marker, Popup, Source, Layer } from 'react-map-gl/maplibre'
import { MapPin, Phone, Route as RouteIcon } from 'lucide-react'
import BaseMap from '@/components/map/BaseMap'
import { IncidentPin, ClusterMarker, TanodMarker, MeasureDot } from '@/components/map/Markers'
import {
  clusterByOverlap, separateCoincident, circlePolygon, lngLatBounds, PRIORITY_RANK,
} from '@/lib/mapGeometry'
import { coverageGrid, boundsOf, formatDistance, formatEta } from '@/lib/geo'
import { timeAgo, fullDate } from '@/lib/timeAgo'
import { DEFAULT_VIEW } from '@/lib/mapConfig'

/**
 * The incident map itself: pins, tanods, routes and the analysis layers.
 *
 * It draws what it is given and owns nothing about filtering or dispatch —
 * that is the console's job (components/CommandMap.jsx). Pins are grouped
 * only where they would overlap on screen (lib/mapGeometry.clusterByOverlap);
 * at zoom 18 and closer every incident gets its own pin, with stacked
 * reports nudged apart by a few metres.
 */

const PIN_ALL_ZOOM = 18
// Pins stand 56 px above their coordinate, and the toolbar and legend sit
// over the map's top and bottom edges: fit inside what is actually visible.
const FIT_PADDING = { top: 130, bottom: 150, left: 70, right: 70 }

function initialView(incidents, tanods, padding) {
  const bounds = lngLatBounds([...incidents, ...tanods])
  if (!bounds) return DEFAULT_VIEW
  const [[w, s], [e, n]] = bounds
  if (w === e && s === n) return { longitude: w, latitude: s, zoom: 16 }
  return { bounds, fitBoundsOptions: { padding, maxZoom: 17 } }
}

export default function IncidentMap({
  incidents = [],          // mappable incidents, already filtered by the console
  tanods = [],             // [{ tanodId, tanod, latitude, longitude, stale, recordedAt, firstAt, accuracy }]
  routes = [],             // [{ key, tanodId, incidentId, incidentTitle, status, path, meters, seconds }]
  selectedId = null,
  flyTarget = null,        // { id, nonce } — set when an incident is picked from the queue
  onSelect,
  onOpenGroup,             // (incidents[]) => void
  theme = 'light',
  basemap = 'clean',
  layers = { tanods: true, heatmap: false, coverage: false },
  coverageInput = null,    // { trailPoints, incidents } for patrol gaps
  measure = null,          // { center: [lat, lng], radius } when the measure tool has a point
  measuring = false,
  onMapClick,              // ({ lat, lng }) => void
  emptyMessage = 'Incidents and on-duty tanods will appear here.',
  controlsPosition = 'bottom-right', // phones: 'top-right', clear of the bottom sheet
  showZoom = true,                    // phones pinch to zoom; the buttons only crowd the map
  fitPadding = FIT_PADDING,           // phones: room for the bottom sheet
  flyOffset = [0, 28],                // phones: land above the sheet, not under it
}) {
  const mapRef = useRef(null)
  const [map, setMap] = useState(null)
  const [zoom, setZoom] = useState(null)
  const [openTanodId, setOpenTanodId] = useState(null)
  const [startView] = useState(() => initialView(incidents, tanods, fitPadding))
  const isDark = theme === 'dark'

  // ---- Grouping: recomputed per zoom level, not per pan (screen distances
  // between points do not change when the map only moves). ----
  const placed = useMemo(() => {
    if (!map || zoom == null) return []
    if (zoom >= PIN_ALL_ZOOM) {
      return separateCoincident(incidents).map(p => ({ kind: 'pin', ...p }))
    }
    return clusterByOverlap(incidents, (lngLat) => map.project(lngLat)).map(g =>
      g.incidents.length === 1
        ? { kind: 'pin', incident: g.incidents[0], latitude: g.incidents[0].latitude, longitude: g.incidents[0].longitude }
        : { kind: 'group', ...g })
  }, [map, zoom, incidents])

  // ---- Fly to an incident chosen from the queue. A pin tapped on the map
  // does not fly: the user is already looking at it. ----
  const flownRef = useRef(null)
  useEffect(() => {
    if (!map || !flyTarget || flownRef.current === flyTarget.nonce) return
    flownRef.current = flyTarget.nonce
    const inc = incidents.find(i => i.id === flyTarget.id)
    if (!inc) return
    map.flyTo({ center: [inc.longitude, inc.latitude], zoom: Math.max(map.getZoom(), 16.5), offset: flyOffset, duration: 700 })
  }, [map, flyTarget, incidents, flyOffset])

  function openGroup(group) {
    onOpenGroup?.(group)
    const b = lngLatBounds(group)
    if (b && map) map.fitBounds(b, { padding: fitPadding, maxZoom: PIN_ALL_ZOOM, duration: 600 })
  }

  // ---- GeoJSON for the drawn layers ----
  const routeData = useMemo(() => ({
    type: 'FeatureCollection',
    features: routes.filter(r => r.status === 'ready' && r.path?.length > 1).map(r => ({
      type: 'Feature', properties: { key: r.key }, geometry: { type: 'LineString', coordinates: r.path },
    })),
  }), [routes])

  const heatData = useMemo(() => ({
    type: 'FeatureCollection',
    features: incidents.filter(i => i.status !== 'resolved').map(i => ({
      type: 'Feature',
      properties: { w: PRIORITY_RANK[i.priority] || 2 },
      geometry: { type: 'Point', coordinates: [i.longitude, i.latitude] },
    })),
  }), [incidents])

  const gapData = useMemo(() => {
    if (!layers.coverage || !coverageInput) return null
    const pts = [
      ...coverageInput.trailPoints.map(p => [p.latitude, p.longitude]),
      ...coverageInput.incidents.map(i => [i.latitude, i.longitude]),
    ]
    const bounds = boundsOf(pts)
    if (!bounds) return null
    const grid = coverageGrid(coverageInput.trailPoints, bounds)
    return {
      type: 'FeatureCollection',
      features: grid.cells.filter(c => !c.covered).map(c => {
        const [[s, w], [n, e]] = c.bounds
        return {
          type: 'Feature', properties: {},
          geometry: { type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] },
        }
      }),
    }
  }, [layers.coverage, coverageInput])

  const measureData = useMemo(() => (measure?.center ? {
    type: 'Feature', properties: {},
    geometry: { type: 'Polygon', coordinates: [circlePolygon(measure.center, measure.radius)] },
  } : null), [measure])

  const readyRoutes = routeData.features.length
  const openTanod = layers.tanods ? tanods.find(t => t.tanodId === openTanodId) : null
  const routesByTanod = useMemo(() => {
    const m = {}
    for (const r of routes) (m[r.tanodId] ||= []).push(r)
    return m
  }, [routes])

  const mapIsEmpty = incidents.length === 0 && (!layers.tanods || tanods.length === 0)

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <BaseMap
        ref={mapRef}
        theme={theme}
        basemap={basemap}
        initialViewState={startView}
        cursor={measuring ? 'crosshair' : undefined}
        customAttribution={readyRoutes ? 'Routes: <a href="https://openrouteservice.org/" target="_blank" rel="noopener noreferrer">openrouteservice</a> by HeiGIT' : undefined}
        onLoad={(e) => { setMap(e.target); setZoom(e.target.getZoom()) }}
        onZoomEnd={(e) => setZoom(e.viewState.zoom)}
        controlsPosition={controlsPosition}
        showZoom={showZoom}
        onClick={(e) => {
          // Taps on a marker or popup also reach the map; they are not map clicks.
          if (e.originalEvent?.target?.closest?.('.maplibregl-marker, .maplibregl-popup')) return
          setOpenTanodId(null)
          onMapClick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng })
        }}
      >
        {layers.heatmap && (
          <Source id="bh-heat" type="geojson" data={heatData}>
            <Layer
              id="bh-heat"
              type="heatmap"
              maxzoom={18}
              paint={{
                'heatmap-weight': ['interpolate', ['linear'], ['get', 'w'], 1, 0.3, 4, 1],
                'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 11, 0.8, 17, 2],
                'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 11, 14, 17, 48],
                'heatmap-opacity': 0.75,
                'heatmap-color': [
                  'interpolate', ['linear'], ['heatmap-density'],
                  0, 'rgba(91,84,232,0)', 0.25, 'rgba(124,117,240,0.55)',
                  0.5, 'rgba(249,115,22,0.7)', 0.8, 'rgba(220,38,38,0.8)', 1, 'rgba(185,28,28,0.9)',
                ],
              }}
            />
          </Source>
        )}

        {gapData && (
          <Source id="bh-gaps" type="geojson" data={gapData}>
            <Layer id="bh-gaps-fill" type="fill" paint={{ 'fill-color': '#dc2626', 'fill-opacity': 0.13 }} />
            <Layer id="bh-gaps-line" type="line" paint={{ 'line-color': '#dc2626', 'line-opacity': 0.3, 'line-width': 0.5 }} />
          </Source>
        )}

        {measureData && (
          <Source id="bh-measure" type="geojson" data={measureData}>
            <Layer id="bh-measure-fill" type="fill" paint={{ 'fill-color': '#5B54E8', 'fill-opacity': 0.08 }} />
            <Layer id="bh-measure-line" type="line" paint={{ 'line-color': '#5B54E8', 'line-width': 2, 'line-dasharray': [2, 2] }} />
          </Source>
        )}

        {layers.tanods && readyRoutes > 0 && (
          <Source id="bh-routes" type="geojson" data={routeData}>
            <Layer
              id="bh-routes-casing"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': isDark ? '#0f1117' : '#ffffff', 'line-width': 9, 'line-opacity': 0.95 }}
            />
            <Layer
              id="bh-routes"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': '#16a34a', 'line-width': 5, 'line-dasharray': [2, 1.4] }}
            />
          </Source>
        )}

        {measure?.center && (
          <Marker longitude={measure.center[1]} latitude={measure.center[0]} anchor="center">
            <MeasureDot />
          </Marker>
        )}

        {placed.map(p => p.kind === 'pin' ? (
          <Marker
            key={p.incident.id}
            longitude={p.longitude}
            latitude={p.latitude}
            anchor="bottom"
            style={{ zIndex: p.incident.id === selectedId ? 4 : p.incident.status === 'pending' ? 2 : 1 }}
          >
            <IncidentPin incident={p.incident} selected={p.incident.id === selectedId} onSelect={onSelect} />
          </Marker>
        ) : (
          <Marker
            key={`group-${p.incidents.map(i => i.id).sort().join('|')}`}
            longitude={p.longitude}
            latitude={p.latitude}
            anchor="center"
            style={{ zIndex: 2 }}
          >
            <ClusterMarker incidents={p.incidents} onOpen={openGroup} />
          </Marker>
        ))}

        {layers.tanods && tanods.map(t => (
          <Marker key={`tanod-${t.tanodId}`} longitude={t.longitude} latitude={t.latitude} anchor="center" style={{ zIndex: 3 }}>
            <TanodMarker position={t} onOpen={setOpenTanodId} />
          </Marker>
        ))}

        {openTanod && (
          <Popup
            longitude={openTanod.longitude}
            latitude={openTanod.latitude}
            anchor="bottom"
            offset={26}
            maxWidth="260px"
            closeOnClick={false}
            onClose={() => setOpenTanodId(null)}
          >
            <TanodDetails position={openTanod} routes={routesByTanod[openTanod.tanodId] || []} />
          </Popup>
        )}
      </BaseMap>

      {mapIsEmpty && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none', zIndex: 2 }}>
          <div style={{
            pointerEvents: 'auto', padding: '16px 20px', borderRadius: 18, textAlign: 'center', maxWidth: 280,
            background: isDark ? 'rgba(28,32,48,.96)' : 'rgba(255,255,255,.96)', boxShadow: '0 8px 32px rgba(0,0,0,.18)',
          }}>
            <MapPin size={22} style={{ margin: '0 auto 6px', color: isDark ? '#9aa3b8' : '#70677d' }} aria-hidden="true" />
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Nothing on the map</p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: isDark ? '#9aa3b8' : '#70677d' }}>{emptyMessage}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function TanodDetails({ position, routes }) {
  const name = position.tanod?.full_name || 'Tanod'
  const phone = position.tanod?.phone?.replace(/[^0-9+]/g, '')
  const responding = routes.length > 0
  return (
    <div style={{ minWidth: 200, fontSize: 12, lineHeight: 1.6 }}>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{name}</p>
      <p style={{ margin: '2px 0 8px', fontWeight: 700, color: position.stale ? '#b45309' : responding ? '#1d4ed8' : '#047857' }}>
        {position.stale ? 'On duty · signal lost' : responding ? 'Responding' : 'On duty · available'}
      </p>
      {routes.map(r => (
        <p key={r.key} style={{ display: 'flex', gap: 6, margin: '0 0 6px' }}>
          <RouteIcon size={14} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
          <span>
            <strong style={{ fontWeight: 700 }}>{r.incidentTitle}</strong>
            {r.status === 'ready' && Number.isFinite(r.seconds) && <> · {formatDistance(r.meters)} by road, about {formatEta(Math.max(1, Math.round(r.seconds / 60)))}</>}
            {r.status === 'loading' && <> · finding a road route…</>}
            {r.status === 'unavailable' && <> · no road route available</>}
            {r.status === 'stale' && <> · route paused, location is old</>}
          </span>
        </p>
      ))}
      <p style={{ margin: 0, opacity: 0.8 }} title={fullDate(position.recordedAt)}>Position updated {timeAgo(position.recordedAt)}</p>
      {Number.isFinite(position.accuracy) && <p style={{ margin: 0, opacity: 0.8 }}>Accurate to about {Math.round(position.accuracy)} m</p>}
      {position.stale && <p style={{ margin: '8px 0 0', color: '#92400e' }}>No update for over 5 minutes. Their phone may be locked; consider calling.</p>}
      {phone && (
        <a href={`tel:${phone}`} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 40, marginTop: 10,
          borderRadius: 12, background: '#ecfdf5', color: '#047857', fontWeight: 700, textDecoration: 'none',
        }}>
          <Phone size={14} aria-hidden="true" /> Call {name.split(' ')[0]}
        </a>
      )}
    </div>
  )
}
