'use client'
import { useMemo, useState, useEffect } from 'react'
import { Rectangle, Circle, CircleMarker, Tooltip, useMapEvents } from 'react-leaflet'
import { coverageGrid, boundsOf, distanceMeters, formatDistance } from '@/lib/geo'

/**
 * Optional overlay layers for the command map. Each is independent and
 * renders nothing unless switched on, so they cost nothing when off.
 *
 * IMPORTANT: this module imports react-leaflet, which touches `window` at
 * import time. Anything that imports THIS file can therefore only be loaded
 * through a dynamic import with `ssr: false`. Pure helpers that the server
 * also needs (coverage stats, time-machine filtering) live in lib/mapStats
 * for exactly this reason — keep them out of here.
 */

/* ========================================================================
   COVERAGE GAPS

   Shades the areas NO tanod has patrolled recently. Deliberately inverted:
   a map of where patrols HAVE been is reassuring but not actionable — the
   useful question is which streets have been left alone for nine hours.
======================================================================== */
export function CoverageLayer({ trailPoints = [], incidents = [], lookbackHours = 6, cellMeters = 150 }) {
  const grid = useMemo(() => {
    const points = [
      ...trailPoints.map(p => [p.latitude, p.longitude]),
      ...incidents.map(i => [i.latitude, i.longitude]),
    ]
    const bounds = boundsOf(points)
    if (!bounds) return null
    return coverageGrid(trailPoints, bounds, cellMeters, lookbackHours * 3600 * 1000)
  }, [trailPoints, incidents, lookbackHours, cellMeters])

  if (!grid) return null

  return (
    <>
      {grid.cells.filter(c => !c.covered).map(cell => (
        <Rectangle
          key={cell.key}
          bounds={cell.bounds}
          pathOptions={{
            color: '#dc2626',
            weight: 0.5,
            opacity: 0.25,
            fillColor: '#dc2626',
            fillOpacity: 0.13,
          }}
        >
          <Tooltip sticky>
            <span style={{ fontSize: 11 }}>
              No patrol here in the last {lookbackHours}h
            </span>
          </Tooltip>
        </Rectangle>
      ))}
    </>
  )
}

/* ========================================================================
   INCIDENT HEATMAP

   Density rather than individual pins. Implemented with layered translucent
   circles instead of leaflet.heat: no extra dependency, and — more usefully
   — each blob is weighted by PRIORITY, so one critical incident carries more
   visual weight than three noise complaints. A raw point-density heatmap
   would say the opposite.
======================================================================== */
const HEAT_WEIGHT = { Critical: 4, High: 3, Medium: 2, Low: 1 }

export function HeatmapLayer({ incidents = [], radiusMeters = 120 }) {
  const points = useMemo(
    () => incidents.filter(i => Number.isFinite(i.latitude) && Number.isFinite(i.longitude)),
    [incidents]
  )

  return (
    <>
      {points.map(inc => {
        const w = HEAT_WEIGHT[inc.priority] || 2
        const resolved = inc.status === 'resolved'
        return (
          <Circle
            key={`heat-${inc.id}`}
            center={[inc.latitude, inc.longitude]}
            radius={radiusMeters * (0.7 + w * 0.15)}
            pathOptions={{
              stroke: false,
              fillColor: w >= 4 ? '#dc2626' : w === 3 ? '#f97316' : w === 2 ? '#eab308' : '#22c55e',
              fillOpacity: resolved ? 0.06 : 0.055 + w * 0.035,
            }}
          />
        )
      })}
    </>
  )
}

/* ========================================================================
   RADIUS TOOL

   Click anywhere to drop a ring and count what's inside. Answers the
   question officials actually ask on scene: "what else is happening within
   200m of here, and who's nearby?"
======================================================================== */
export function RadiusTool({ active, radius = 200, incidents = [], tanodPositions = [], onResult }) {
  const [center, setCenter] = useState(null)

  useMapEvents({
    click(e) {
      if (!active) return
      setCenter([e.latlng.lat, e.latlng.lng])
    },
  })

  useEffect(() => { if (!active) setCenter(null) }, [active])

  const inside = useMemo(() => {
    if (!center) return null
    const inc = incidents.filter(i =>
      Number.isFinite(i.latitude) && distanceMeters(center, [i.latitude, i.longitude]) <= radius
    )
    const tan = tanodPositions.filter(t =>
      Number.isFinite(t.latitude) && distanceMeters(center, [t.latitude, t.longitude]) <= radius
    )
    return { incidents: inc, tanods: tan }
  }, [center, radius, incidents, tanodPositions])

  useEffect(() => { onResult?.(inside) }, [inside]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!active || !center) return null

  return (
    <>
      <Circle
        center={center}
        radius={radius}
        pathOptions={{
          color: '#5B54E8', weight: 2, opacity: 0.8,
          fillColor: '#5B54E8', fillOpacity: 0.08,
          dashArray: '6,6',
        }}
      />
      <CircleMarker
        center={center}
        radius={5}
        pathOptions={{ color: 'white', weight: 2, fillColor: '#5B54E8', fillOpacity: 1 }}
      >
        <Tooltip permanent direction="top" offset={[0, -8]}>
          <span style={{ fontSize: 11, fontWeight: 700 }}>
            {formatDistance(radius)} radius · {inside?.incidents.length || 0} incidents · {inside?.tanods.length || 0} tanods
          </span>
        </Tooltip>
      </CircleMarker>
    </>
  )
}