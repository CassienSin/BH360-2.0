/**
 * Geospatial helpers for the command map.
 *
 * All pure functions — no Leaflet, no React — so they can be unit tested
 * and reused by analytics later.
 */

const EARTH_R = 6371000

/** Great-circle distance in metres. */
export function distanceMeters(a, b) {
  const toRad = d => (d * Math.PI) / 180
  const dLat = toRad(b[0] - a[0])
  const dLng = toRad(b[1] - a[1])
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_R * Math.asin(Math.sqrt(s))
}

export function formatDistance(m) {
  if (!Number.isFinite(m)) return '—'
  return m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`
}

/**
 * Rough travel-time estimate.
 *
 * Straight-line distance understates real travel, so it is multiplied by a
 * detour factor for the winding streets and footpaths typical of a
 * barangay. Speeds are deliberately conservative — an ETA that proves
 * optimistic is worse than one that proves pessimistic when someone is
 * waiting for help.
 */
const DETOUR_FACTOR = 1.35
const SPEED_MPS = {
  foot: 1.25,        // ~4.5 km/h — walking, alleys, night
  motorcycle: 5.5,   // ~20 km/h — realistic barangay street speed
}

export function etaMinutes(meters, mode = 'foot') {
  if (!Number.isFinite(meters)) return null
  const speed = SPEED_MPS[mode] || SPEED_MPS.foot
  return Math.max(1, Math.round((meters * DETOUR_FACTOR) / speed / 60))
}

export function formatEta(minutes) {
  if (minutes == null) return '—'
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

/**
 * Rank responders for a given incident.
 *
 * Ordering rationale: on-duty always outranks off-duty (dispatching someone
 * who isn't working is a false assignment). Among on-duty, the score
 * balances proximity against current load — the closest tanod is usually
 * right, but not when they are already handling three incidents and someone
 * 200m further away is free.
 *
 * @param {Object} incident        needs latitude/longitude
 * @param {Array}  tanodPositions  [{ tanodId, tanod, latitude, longitude, stale, recordedAt }]
 * @param {Object} activeCounts    { [tanodId]: number of active assignments }
 */
export function rankResponders(incident, tanodPositions = [], activeCounts = {}) {
  if (!incident || !Number.isFinite(incident.latitude)) return []
  const target = [incident.latitude, incident.longitude]

  return tanodPositions
    .filter(t => Number.isFinite(t.latitude) && Number.isFinite(t.longitude))
    .map(t => {
      const meters = distanceMeters([t.latitude, t.longitude], target)
      const load = activeCounts[t.tanodId] || 0
      const onDuty = Boolean(t.tanod?.on_duty)

      // Lower is better. Each active assignment costs the equivalent of
      // 250m of extra distance; a stale signal costs 400m of confidence.
      const score =
        meters +
        load * 250 +
        (t.stale ? 400 : 0) +
        (onDuty ? 0 : 100000)   // off-duty always sorts last

      return {
        ...t,
        meters,
        load,
        onDuty,
        etaFoot: etaMinutes(meters, 'foot'),
        etaMoto: etaMinutes(meters, 'motorcycle'),
        score,
      }
    })
    .sort((a, b) => a.score - b.score)
}

/**
 * Patrol coverage gaps.
 *
 * Divides the area into a grid and marks each cell covered if any tanod
 * trail point falls inside it within the lookback window. Uncovered cells
 * are what the map shades — "Purok 5 hasn't been patrolled in 9 hours" is
 * actionable in a way that a map of where people HAVE been is not.
 *
 * @param {Array}  trailPoints  [{ latitude, longitude, recorded_at }]
 * @param {Object} bounds       { north, south, east, west }
 * @param {number} cellMeters   grid resolution
 * @param {number} lookbackMs   how far back counts as "covered"
 */
export function coverageGrid(trailPoints = [], bounds, cellMeters = 150, lookbackMs = 6 * 3600 * 1000) {
  if (!bounds) return { cells: [], coveredCount: 0, totalCount: 0 }

  const { north, south, east, west } = bounds
  const latSpanM = distanceMeters([south, west], [north, west])
  const lngSpanM = distanceMeters([south, west], [south, east])
  if (!latSpanM || !lngSpanM) return { cells: [], coveredCount: 0, totalCount: 0 }

  const rows = Math.max(1, Math.min(40, Math.ceil(latSpanM / cellMeters)))
  const cols = Math.max(1, Math.min(40, Math.ceil(lngSpanM / cellMeters)))
  const latStep = (north - south) / rows
  const lngStep = (east - west) / cols

  const cutoff = Date.now() - lookbackMs
  // cellKey -> most recent visit timestamp
  const visits = new Map()

  for (const p of trailPoints) {
    if (!Number.isFinite(p.latitude) || !Number.isFinite(p.longitude)) continue
    const t = new Date(p.recorded_at).getTime()
    if (!Number.isFinite(t) || t < cutoff) continue
    const r = Math.floor((p.latitude - south) / latStep)
    const c = Math.floor((p.longitude - west) / lngStep)
    if (r < 0 || r >= rows || c < 0 || c >= cols) continue
    const key = `${r}:${c}`
    if (!visits.has(key) || visits.get(key) < t) visits.set(key, t)
  }

  const cells = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = `${r}:${c}`
      const lastVisit = visits.get(key) || null
      cells.push({
        key,
        covered: Boolean(lastVisit),
        lastVisit,
        bounds: [
          [south + r * latStep, west + c * lngStep],
          [south + (r + 1) * latStep, west + (c + 1) * lngStep],
        ],
      })
    }
  }

  return {
    cells,
    coveredCount: visits.size,
    totalCount: cells.length,
    coveragePct: cells.length ? Math.round((visits.size / cells.length) * 100) : 0,
  }
}

/** Bounding box around a set of points, padded slightly. */
export function boundsOf(points, padDeg = 0.002) {
  const valid = points.filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]))
  if (valid.length === 0) return null
  const lats = valid.map(p => p[0])
  const lngs = valid.map(p => p[1])
  return {
    north: Math.max(...lats) + padDeg,
    south: Math.min(...lats) - padDeg,
    east: Math.max(...lngs) + padDeg,
    west: Math.min(...lngs) - padDeg,
  }
}