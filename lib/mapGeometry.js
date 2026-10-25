/**
 * Pure geometry and status helpers for the incident map. Nothing here
 * imports the map library, so all of it runs (and is tested) without a
 * browser.
 */

export const PRIORITY_RANK = { Low: 1, Medium: 2, High: 3, Critical: 4 }

/**
 * How long an incident may stay pending before it counts as overdue.
 * Critical means life or property at immediate risk: 15 minutes.
 */
export const RESPONSE_WINDOW_MS = {
  Critical: 15 * 60 * 1000,
  High: 4 * 3600 * 1000,
  Medium: 24 * 3600 * 1000,
  Low: 72 * 3600 * 1000,
}

/** Milliseconds a pending incident is past its response window, else 0. */
export function overdueMs(incident, now) {
  if (!incident || incident.status !== 'pending') return 0
  const created = new Date(incident.created_at).getTime()
  if (!Number.isFinite(created)) return 0
  const window = RESPONSE_WINDOW_MS[incident.priority] ?? RESPONSE_WINDOW_MS.Medium
  return Math.max(0, now - created - window)
}

export function isOverdue(incident, now) {
  return overdueMs(incident, now) > 0
}

/** Urgency used to order pins and pick a group's anchor; resolved is lowest. */
export function urgency(incident) {
  if (!incident || incident.status === 'resolved') return 0
  return PRIORITY_RANK[incident.priority] || PRIORITY_RANK.Medium
}

export function hasCoords(item) {
  return Number.isFinite(item?.latitude) && Number.isFinite(item?.longitude)
}

const METERS_PER_DEG_LAT = 111320

/**
 * A circle as a GeoJSON polygon ring of [lng, lat] pairs. Close enough to
 * a true geodesic circle at barangay scale (a few hundred metres).
 */
export function circlePolygon([lat, lng], radiusMeters, steps = 64) {
  const dLat = radiusMeters / METERS_PER_DEG_LAT
  const dLng = radiusMeters / (METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180))
  const ring = []
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI
    ring.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)])
  }
  return ring
}

/** Stable hash of an id → an angle, so the same incident always lands in the same place. */
function hashAngle(id) {
  const s = String(id)
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return (Math.abs(h) % 360) * (Math.PI / 180)
}

/**
 * Pins at (nearly) the same coordinate are pushed apart by a few metres
 * along a hashed angle, so every one stays tappable at full zoom. The
 * displacement sits inside the ±10–30 m GPS error the reports already
 * carry, and the drawer always shows the true location.
 *
 * @returns {Array<{ incident, latitude, longitude, offset: boolean }>}
 */
export function separateCoincident(incidents, epsDeg = 0.00012, offsetMeters = 6) {
  const out = []
  const taken = new Set()
  for (const inc of incidents) {
    if (taken.has(inc.id)) continue
    const group = [inc]
    taken.add(inc.id)
    for (const other of incidents) {
      if (taken.has(other.id)) continue
      if (Math.abs(other.latitude - inc.latitude) < epsDeg &&
          Math.abs(other.longitude - inc.longitude) < epsDeg) {
        group.push(other)
        taken.add(other.id)
      }
    }
    if (group.length === 1) {
      out.push({ incident: inc, latitude: inc.latitude, longitude: inc.longitude, offset: false })
      continue
    }
    const meters = offsetMeters + Math.min(group.length, 10) * 1.5
    for (const g of group) {
      const a = hashAngle(g.id)
      const dLat = meters / METERS_PER_DEG_LAT
      const dLng = meters / (METERS_PER_DEG_LAT * Math.cos((g.latitude * Math.PI) / 180))
      out.push({
        incident: g,
        latitude: g.latitude + dLat * Math.sin(a),
        longitude: g.longitude + dLng * Math.cos(a),
        offset: true,
      })
    }
  }
  return out
}

/**
 * Group incidents only where their pins would actually overlap on screen.
 *
 * The old map grouped by zoom level — everything was a blob below zoom 18
 * even when the pins had plenty of room. This keeps a pin individual
 * whenever it fits, and merges only the ones that would collide.
 *
 * Greedy and deterministic: incidents are visited most-urgent first, so a
 * group is anchored on its most urgent member, and the same data at the
 * same zoom always groups the same way.
 *
 * @param {Array}    incidents  items with latitude/longitude
 * @param {Function} project    ([lng, lat]) => { x, y } screen pixels
 * @param {number}   overlapPx  pins closer than this on both axes merge
 * @returns {Array<{ incidents: Array, latitude: number, longitude: number }>}
 */
export function clusterByOverlap(incidents, project, overlapPx = 44) {
  const sorted = [...incidents].sort((a, b) =>
    urgency(b) - urgency(a) || String(a.id).localeCompare(String(b.id)))
  const groups = []
  for (const inc of sorted) {
    const p = project([inc.longitude, inc.latitude])
    let home = null
    for (const g of groups) {
      if (Math.abs(g.x - p.x) < overlapPx && Math.abs(g.y - p.y) < overlapPx) { home = g; break }
    }
    if (home) home.incidents.push(inc)
    else groups.push({ x: p.x, y: p.y, incidents: [inc] })
  }
  return groups.map(g => {
    const n = g.incidents.length
    return {
      incidents: g.incidents,
      latitude: g.incidents.reduce((s, i) => s + i.latitude, 0) / n,
      longitude: g.incidents.reduce((s, i) => s + i.longitude, 0) / n,
    }
  })
}

/** The highest priority among a group's unresolved incidents, or null. */
export function topPriority(incidents) {
  let best = null
  for (const inc of incidents) {
    const u = urgency(inc)
    if (u > 0 && (!best || u > PRIORITY_RANK[best])) best = inc.priority in PRIORITY_RANK ? inc.priority : 'Medium'
  }
  return best
}

/** [[west, south], [east, north]] around points, or null. Points are { latitude, longitude }. */
export function lngLatBounds(points) {
  const valid = points.filter(hasCoords)
  if (valid.length === 0) return null
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity
  for (const p of valid) {
    west = Math.min(west, p.longitude); east = Math.max(east, p.longitude)
    south = Math.min(south, p.latitude); north = Math.max(north, p.latitude)
  }
  return [[west, south], [east, north]]
}
