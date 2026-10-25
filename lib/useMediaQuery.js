'use client'
import { useSyncExternalStore, useCallback } from 'react'

/**
 * Whether a CSS media query currently matches. The server has no viewport,
 * so it renders with `serverValue`; the client corrects it after hydration.
 */
export function useMediaQuery(query, serverValue = true) {
  const subscribe = useCallback((onChange) => {
    const mql = window.matchMedia(query)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverValue
  )
}
