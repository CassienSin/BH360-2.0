'use client'
import { useSyncExternalStore } from 'react'

/**
 * A once-a-second clock for visible time displays (the dashboard header's
 * live clock). Returns a timestamp in ms, or null on the server and during
 * hydration so the server and client markup never disagree.
 *
 * For coarse "x minutes ago" logic use lib/useNow instead, which ticks
 * every 15 s and is cheaper for large lists.
 */
let now = null
let timer = null
const listeners = new Set()

function subscribe(listener) {
  listeners.add(listener)
  if (!timer) {
    now = Date.now()
    timer = setInterval(() => {
      now = Date.now()
      listeners.forEach(l => l())
    }, 1000)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) { clearInterval(timer); timer = null }
  }
}

export function useClock() {
  return useSyncExternalStore(subscribe, () => now, () => null)
}
