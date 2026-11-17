'use client'
import { Suspense } from 'react'
import { useHydrated } from '@/lib/useHydrated'

function AfterHydration({ fallback, children }) {
  return useHydrated() ? children : fallback
}

/**
 * The boundary around a page that reads the URL (useSearchParams) and
 * browser-only state (saved sidebar width, viewport, storage).
 *
 * - Suspense: required around useSearchParams. In a production build the
 *   page is prerendered without the query string, so the server sends only
 *   `fallback` and the browser renders the page.
 * - AfterHydration: in `next dev` (and on any request-time render) the server
 *   renders the page instead and React hydrates it, so the first render must
 *   use server defaults — the sidebar drew open, then slid shut a moment
 *   later; on phones the whole nav drawer flashed open. Rendering `fallback`
 *   until hydration finishes makes dev behave like production: the page's
 *   first real render already sees the browser's values.
 *
 * In production the boundary is client-rendered, useHydrated() is already
 * true there, and this costs nothing.
 */
export default function ClientBoundary({ fallback, children }) {
  return (
    <Suspense fallback={fallback}>
      <AfterHydration fallback={fallback}>{children}</AfterHydration>
    </Suspense>
  )
}
