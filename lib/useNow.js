'use client'
import { useSyncExternalStore } from 'react'

/**
 * The current time, as a value React can render with.
 *
 * Calling Date.now() during render makes a component impure: two renders
 * of the same props disagree, and the countdowns that read it only move
 * when something else happens to re-render. This shares ONE ticking clock
 * across every subscriber instead, so all of them advance together.
 *
 * The tick is coarse on purpose (15 s). Response windows and "4 min ago"
 * labels do not need second precision, and a map with hundreds of pins
 * should not re-render every second.
 */
const TICK_MS = 15 * 1000

let now = Date.now()
let timer = null
const listeners = new Set()

function subscribe(listener) {
  listeners.add(listener)
  if (!timer) {
    now = Date.now()
    timer = setInterval(() => {
      now = Date.now()
      listeners.forEach(l => l())
    }, TICK_MS)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      clearInterval(timer)
      timer = null
    }
  }
}

const getSnapshot = () => now

export function useNow() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
