'use client'
import { useMemo } from 'react'
import { coverageGrid, boundsOf } from '@/lib/geo'

/**
 * Map-derived statistics with no map-library dependency.
 *
 * The map components need the browser (MapLibre touches `window`), so they
 * load with SSR disabled. The console renders on the server too and needs
 * these numbers, so they live here, apart from any map code.
 */

/** Patrol coverage summary for the status ribbon. */
export function useCoverageStats(trailPoints = [], incidents = [], lookbackHours = 6, cellMeters = 150) {
  return useMemo(() => {
    const points = [
      ...trailPoints.map(p => [p.latitude, p.longitude]),
      ...incidents.map(i => [i.latitude, i.longitude]),
    ]
    const bounds = boundsOf(points)
    if (!bounds) return null
    const g = coverageGrid(trailPoints, bounds, cellMeters, lookbackHours * 3600 * 1000)
    return { pct: g.coveragePct, covered: g.coveredCount, total: g.totalCount }
  }, [trailPoints, incidents, lookbackHours, cellMeters])
}

/**
 * The state of the barangay at a past moment: which incidents existed, and
 * where each tanod was (their last recorded point before that moment).
 * Powers the time scrubber.
 */
export function stateAtTime(incidents, tanodTrails, atMs) {
  const inc = incidents.filter(i => new Date(i.created_at).getTime() <= atMs)

  const positions = []
  for (const [tanodId, { tanod, points }] of Object.entries(tanodTrails || {})) {
    const past = (points || [])
      .filter(p => new Date(p.recorded_at).getTime() <= atMs && Number.isFinite(p.latitude))
    if (past.length === 0) continue
    const latest = past[past.length - 1]
    positions.push({
      tanodId,
      tanod,
      latitude: latest.latitude,
      longitude: latest.longitude,
      recordedAt: latest.recorded_at,
      stale: atMs - new Date(latest.recorded_at).getTime() > 5 * 60 * 1000,
    })
  }

  return { incidents: inc, tanodPositions: positions }
}