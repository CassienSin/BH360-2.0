'use client'
import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}

/**
 * false on the server and during hydration, true once the app is running
 * in the browser. Replaces the `const [mounted, setMounted] = useState(false)`
 * + `useEffect(() => setMounted(true), [])` pattern, without the extra render.
 */
export function useHydrated() {
  return useSyncExternalStore(subscribe, () => true, () => false)
}

/**
 * A browser-only value that does not change while the page is open
 * (platform, standalone mode, …). `read` runs on the client only; the
 * server and hydration render use `serverValue`.
 */
export function useBrowserValue(read, serverValue) {
  return useSyncExternalStore(subscribe, read, () => serverValue)
}
