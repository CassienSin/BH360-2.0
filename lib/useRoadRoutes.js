'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { distanceMeters } from '@/lib/geo'

// A tanod has to move this far before their route is fetched again.
// GPS updates every few seconds; re-routing on each would burn the
// routing quota for a line that barely changes.
const REFETCH_AFTER_METERS = 75

/**
 * Road routes for responders on their way to incidents.
 *
 * @param {Array}  requests [{ key, from: [lat, lng], to: [lat, lng], stale }] — memoize it
 * @param {number} now      current time (lib/useNow), for retrying failed routes
 * @returns {Object} key → { status: 'loading'|'ready'|'unavailable'|'stale', path, meters, seconds }
 */
export function useRoadRoutes(requests, now) {
  const [results, setResults] = useState({})

  const needed = useMemo(() => requests.filter(r => {
    if (r.stale) return false
    const prev = results[r.key]
    if (!prev || prev.status === 'loading') return !prev
    const sameTarget = prev.to && prev.to[0] === r.to[0] && prev.to[1] === r.to[1]
    if (!sameTarget) return true
    // 503 means routing is not set up on the server (no key): asking again
    // will not help until the app restarts with one.
    if (prev.status === 'unavailable') return !prev.notConfigured && now - prev.at > 2 * 60 * 1000
    return distanceMeters(prev.from, r.from) > REFETCH_AFTER_METERS
  }), [requests, results, now])

  // Fetch when the SET of needed routes changes, not on every clock tick:
  // a new array with the same contents must not abort a request in flight.
  const signature = needed.map(r => `${r.key}@${r.from.join(',')}>${r.to.join(',')}`).join('|')
  const neededRef = useRef(needed)
  useEffect(() => { neededRef.current = needed })

  useEffect(() => {
    const needed = neededRef.current
    if (!signature || needed.length === 0) return undefined
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      const entries = await Promise.all(needed.map(async r => {
        try {
          const point = ([lat, lng]) => `${lat.toFixed(6)},${lng.toFixed(6)}`
          const qs = new URLSearchParams({ from: point(r.from), to: point(r.to) })
          const res = await fetch(`/api/directions?${qs}`, { signal: controller.signal })
          const body = await res.json().catch(() => ({}))
          if (!res.ok || !Array.isArray(body.path)) {
            return [r.key, { status: 'unavailable', notConfigured: res.status === 503, from: r.from, to: r.to, at: Date.now(), error: body.error }]
          }
          return [r.key, { status: 'ready', from: r.from, to: r.to, at: Date.now(), ...body }]
        } catch {
          if (controller.signal.aborted) return null
          return [r.key, { status: 'unavailable', from: r.from, to: r.to, at: Date.now() }]
        }
      }))
      if (controller.signal.aborted) return
      setResults(prev => ({ ...prev, ...Object.fromEntries(entries.filter(Boolean)) }))
    }, 600)
    return () => { clearTimeout(timer); controller.abort() }
  }, [signature])

  return useMemo(() => {
    const out = {}
    for (const r of requests) {
      if (r.stale) { out[r.key] = { status: 'stale' }; continue }
      out[r.key] = results[r.key] || { status: 'loading' }
    }
    return out
  }, [requests, results])
}
