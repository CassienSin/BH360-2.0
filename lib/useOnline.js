'use client'
import { useSyncExternalStore } from 'react'

/**
 * Whether the browser thinks it has a connection.
 *
 * navigator.onLine only knows about the network interface, not whether
 * anything is reachable through it — a phone on barangay wifi with no
 * upstream still reads as online. It is the right signal for "show the
 * offline banner", and the wrong one for "this write will succeed", which
 * is why the write paths queue on failure rather than checking this first.
 *
 * useSyncExternalStore rather than an effect: this IS an external store,
 * and subscribing to it properly avoids a render pass that starts wrong and
 * corrects itself. The server snapshot is optimistic so the markup React
 * sends and the markup it hydrates agree.
 */

function subscribe(onChange) {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

const getSnapshot = () => navigator.onLine
const getServerSnapshot = () => true

export function useOnline() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export default useOnline
