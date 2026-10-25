import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Road route between a responder and an incident, from openrouteservice.
 *
 * Runs on the server so the API key never reaches the browser. The free
 * openrouteservice key allows 2,000 directions a day and 40 a minute, so
 * routes are cached by rounded endpoints: GPS jitter of a few metres must
 * not cost a request. The client also only asks again once a tanod has
 * moved a meaningful distance (lib/useRoadRoutes.js).
 *
 * Set OPENROUTESERVICE_API_KEY in .env.local. Without it this answers 503
 * and the map falls back to straight-line distance plus a link to Google
 * Maps directions — it never draws a guessed path.
 */

const ORS_URL = 'https://api.openrouteservice.org/v2/directions/driving-car/geojson'
const CACHE_TTL_MS = 10 * 60 * 1000
const CACHE_MAX = 500
// Per server instance. On Vercel that is a partial cache, which is fine:
// it only exists to absorb repeats, the client-side movement threshold
// does the real work.
const cache = new Map()

function parsePoint(value) {
  const [lat, lng] = String(value || '').split(',').map(Number)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return [lat, lng]
}

function json(body, status = 200, extra = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'private, max-age=60', ...extra } })
}

export async function GET(request) {
  const apiKey = process.env.OPENROUTESERVICE_API_KEY
  if (!apiKey) return json({ error: 'Road routing is not set up.' }, 503)

  // Signed-in officials and tanods only: anyone else would be spending the
  // barangay's routing quota.
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'Please sign in.' }, 401)
  const { data: profile } = await supabase.from('profiles').select('role, is_super_admin').eq('id', user.id).single()
  if (!profile || !(profile.is_super_admin || profile.role === 'official' || profile.role === 'tanod')) {
    return json({ error: 'Not allowed.' }, 403)
  }

  const { searchParams } = new URL(request.url)
  const from = parsePoint(searchParams.get('from'))
  const to = parsePoint(searchParams.get('to'))
  if (!from || !to) return json({ error: 'Give from and to as "lat,lng".' }, 400)

  const key = [...from, ...to].map(v => v.toFixed(4)).join(',')
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return json(hit.body)

  let res
  try {
    res = await fetch(ORS_URL, {
      method: 'POST',
      headers: { Authorization: apiKey, 'Content-Type': 'application/json', Accept: 'application/geo+json' },
      body: JSON.stringify({ coordinates: [[from[1], from[0]], [to[1], to[0]]], instructions: false }),
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    return json({ error: 'The routing service did not answer.' }, 504)
  }
  if (res.status === 429) return json({ error: 'Routing quota reached. Try again shortly.' }, 429, { 'Retry-After': '60' })
  if (!res.ok) return json({ error: 'No road route found.' }, 502)

  const data = await res.json().catch(() => null)
  const feature = data?.features?.[0]
  const coordinates = feature?.geometry?.coordinates
  const summary = feature?.properties?.summary
  if (!Array.isArray(coordinates) || coordinates.length < 2) return json({ error: 'No road route found.' }, 502)

  // GeoJSON order ([lng, lat]) is what the map draws, so it is passed through as is.
  const body = { path: coordinates, meters: summary?.distance ?? null, seconds: summary?.duration ?? null }
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value)
  cache.set(key, { at: Date.now(), body })
  return json(body)
}
